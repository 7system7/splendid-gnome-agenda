
import GObject from 'gi://GObject';
import St from 'gi://St';

import {eventColor, isAllDay, sameDay, timelineRange} from '../utils/eventUtils.js';

export const AvailabilityLine = GObject.registerClass(
class AvailabilityLine extends St.DrawingArea {
    _init() {
        super._init({
            style_class: 'splendid-agenda-timeline',
            x_expand: true,
            height: 25,
        });
        this._events = [];
        this._day = new Date();
        this.connect('repaint', () => this._draw());
        this.connect('style-changed', () => this.queue_repaint());
    }

    setEvents(day, events) {
        this._day = day;
        this._events = events.filter(event => !isAllDay(event));
        this.queue_repaint();
    }

    _range() {
        return timelineRange(this._day, this._events);
    }

    _draw() {
        const context = this.get_context();
        const [width, height] = this.get_surface_size();
        const [rangeStart, rangeEnd] = this._range();
        const duration = rangeEnd - rangeStart;
        const center = Math.floor(height / 2) + 0.5;
        const inset = 3;
        const trackWidth = Math.max(1, width - inset * 2);
        const foreground = this.get_theme_node().get_foreground_color();
        // Clutter colors use bytes; Cairo expects normalized components.
        const [red, green, blue] = [foreground.red, foreground.green, foreground.blue]
            .map(component => component / 255);
        const isDark = red * 0.2126 + green * 0.7152 + blue * 0.0722 > 0.5;

        context.setLineWidth(2);
        context.setSourceRGBA(red, green, blue, 0.38);
        context.moveTo(inset, center);
        context.lineTo(width - inset, center);
        context.stroke();

        for (const fraction of [1 / 3, 2 / 3]) {
            const x = inset + trackWidth * fraction;
            context.setLineWidth(1);
            context.setSourceRGBA(red, green, blue, 0.22);
            context.moveTo(x, center - 4);
            context.lineTo(x, center + 4);
            context.stroke();
        }

        for (const event of this._events) {
            const clippedStart = Math.max(rangeStart.getTime(), event.date.getTime());
            const clippedEnd = Math.min(rangeEnd.getTime(), event.end.getTime());
            if (clippedEnd <= clippedStart)
                continue;

            const x = inset + trackWidth * ((clippedStart - rangeStart) / duration);
            const eventWidth = Math.max(12, trackWidth * ((clippedEnd - clippedStart) / duration));
            const right = Math.min(width - inset, x + eventWidth);
            const radius = Math.min(5, (right - x) / 2);
            if (radius <= 0)
                continue;
            const [red, green, blue] = eventColor(event);

            context.newPath();
            context.arc(x + radius, center, radius, Math.PI / 2, Math.PI * 1.5);
            context.arc(right - radius, center, radius, Math.PI * 1.5, Math.PI / 2);
            context.closePath();
            context.setSourceRGBA(red, green, blue, 0.95);
            context.fillPreserve();
            context.setLineWidth(1);
            context.setSourceRGBA(red, green, blue, 0.32);
            context.stroke();
        }

        const now = new Date();
        if (sameDay(now, this._day) && now >= rangeStart && now < rangeEnd) {
            const x = inset + trackWidth * ((now - rangeStart) / duration);
            context.setLineWidth(2);
            context.setSourceRGBA(...(isDark ? [1, 0.82, 0.49, 1] : [0.65, 0.33, 0, 1]));
            context.moveTo(x, 2);
            context.lineTo(x, height - 2);
            context.stroke();
        }

        context.$dispose();
    }
});
