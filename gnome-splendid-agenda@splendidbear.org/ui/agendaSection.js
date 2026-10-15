import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Pango from 'gi://Pango';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {formatTime} from 'resource:///org/gnome/shell/misc/dateUtils.js';
import {gettext as _, ngettext} from 'resource:///org/gnome/shell/extensions/extension.js';

import {AvailabilityLine} from './availabilityLine.js';
import {LiveEventBackdrop} from './liveEventBackdrop.js';
import {isAllDay, isOngoing, isPast, sameDay, timelineRange, timeUntilEnd} from '../utils/eventUtils.js';

// St CSS does not apply actor opacity. Clutter uses 0–255, not CSS's 0–1.
const PAST_EVENT_OPACITY = 140;

export const AgendaSection = GObject.registerClass(
class AgendaSection extends St.Button {
    _init(settings) {
        super._init({
            style_class: 'events-button splendid-agenda',
            can_focus: true,
            x_expand: true,
        });

        this._day = new Date();
        this._eventSource = null;
        this._sourceSignals = [];
        this._liveBackdrops = [];
        this._settings = settings;
        this._settingsSignal = settings.connect('changed::group-all-day-events', () => this._reload());
        this._dimPastSignal = settings.connect('changed::dim-past-events', () => this._reload());
        this._timelineSignal = settings.connect('changed::show-timeline', () => this._reload());
        this._pulseSignal = settings.connect('changed::pulse-ongoing-events', () => {
            this._syncAnimationTimer();
            this._reload();
        });

        this._content = new St.BoxLayout({
            style_class: 'events-box',
            orientation: Clutter.Orientation.VERTICAL,
            x_expand: true,
            clip_to_allocation: true,
        });
        this.child = this._content;

        this._header = new St.BoxLayout({x_expand: true, clip_to_allocation: true});
        this._title = new St.Label({
            style_class: 'events-title splendid-agenda-title',
            x_expand: true,
            x_align: Clutter.ActorAlign.START,
        });
        this._count = new St.Label({
            style_class: 'events-title splendid-agenda-count',
            x_align: Clutter.ActorAlign.END,
        });
        this._header.add_child(this._title);
        this._header.add_child(this._count);
        this._content.add_child(this._header);
        this.labelActor = this._title;

        this._timeline = new AvailabilityLine();
        this._content.add_child(this._timeline);

        this._rangeLabels = new St.BoxLayout({x_expand: true, clip_to_allocation: true});
        this._rangeStart = new St.Label({style_class: 'events-title splendid-agenda-range-label'});
        this._rangeMiddle = new St.Label({
            style_class: 'events-title splendid-agenda-range-label',
            x_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
        });
        this._rangeEnd = new St.Label({style_class: 'events-title splendid-agenda-range-label'});
        this._rangeLabels.add_child(this._rangeStart);
        this._rangeLabels.add_child(this._rangeMiddle);
        this._rangeLabels.add_child(this._rangeEnd);
        this._content.add_child(this._rangeLabels);

        this._eventsList = new St.BoxLayout({
            style_class: 'events-list splendid-agenda-events',
            orientation: Clutter.Orientation.VERTICAL,
            x_expand: true,
            clip_to_allocation: true,
        });
        this._content.add_child(this._eventsList);
        // Read the native card foreground, before any secondary-label styling.
        this.connect('style-changed', () => this._updateThemeColors());
        this.connect('notify::mapped', () => {
            if (this.mapped)
                this._updateThemeColors();
        });

        this._clockSource = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 30, () => {
            if (sameDay(this._day, new Date()))
                this._reload();
            return GLib.SOURCE_CONTINUE;
        });
        this._animationSource = 0;
        this._syncAnimationTimer();
    }

    _syncAnimationTimer() {
        if (this._animationSource) {
            GLib.Source.remove(this._animationSource);
            this._animationSource = 0;
        }
        if (!this._settings.get_boolean('pulse-ongoing-events'))
            return;
        this._animationSource = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            50,
            () => {
                for (const backdrop of this._liveBackdrops)
                    backdrop.updateAnimation();
                return GLib.SOURCE_CONTINUE;
            });
    }

    setDate(date) {
        this._day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        this._reload();
    }

    setEventSource(source) {
        this._disconnectSource();
        this._eventSource = source;
        if (source) {
            this._sourceSignals.push(source.connect('changed', () => this._reload()));
            this._sourceSignals.push(source.connect('notify::has-calendars', () => this._sync()));
        }
        this._reload();
    }

    _disconnectSource() {
        if (this._eventSource) {
            for (const signal of this._sourceSignals) {
                try {
                    this._eventSource.disconnect(signal);
                } catch {
                    // The old source may already have been destroyed by Shell.
                }
            }
        }
        this._sourceSignals = [];
    }

    _updateThemeColors() {
        const {red, green, blue} = this.get_theme_node().get_foreground_color();
        const isDark = (red * 0.2126 + green * 0.7152 + blue * 0.0722) > 128;
        this._primaryTextStyle = `color: rgb(${red}, ${green}, ${blue});`;
        this._secondaryTextStyle = `color: ${isDark ? '#c0bfbc' : '#5e5c64'};`;
        if (this._isDark !== isDark) {
            this._isDark = isDark;
            this.remove_style_class_name(isDark ? 'light' : 'dark');
            this.add_style_class_name(isDark ? 'dark' : 'light');
        }
        this._applyTextColors();
    }

    _applyTextColors(actor = this._content) {
        if (!actor || !this._primaryTextStyle)
            return;
        if (actor instanceof St.Label) {
            const secondary = actor === this._count ||
                actor.has_style_class_name('splendid-agenda-range-label') ||
                actor.has_style_class_name('splendid-agenda-all-day-names') ||
                actor.has_style_class_name('event-placeholder');
            const style = secondary ? this._secondaryTextStyle : this._primaryTextStyle;
            // Inline colors also cover nested labels and theme selectors with
            // higher specificity. Avoid invalidating unchanged styles.
            if (actor.get_style() !== style)
                actor.set_style(style);
        }
        for (const child of actor.get_children())
            this._applyTextColors(child);
    }

    _dayTitle() {
        const today = new Date();
        if (sameDay(this._day, today))
            return _('Today');
        const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
        if (sameDay(this._day, tomorrow))
            return _('Tomorrow');
        return new Intl.DateTimeFormat(undefined, {
            weekday: 'long', month: 'short', day: 'numeric',
        }).format(this._day);
    }


    _formatRange(events) {
        const [start, end] = timelineRange(this._day, events);
        const middle = new Date((start.getTime() + end.getTime()) / 2);
        return [start, middle, end].map(date => formatTime(date, {timeOnly: true}));
    }

    _eventTime(event) {
        if (isAllDay(event))
            return _('All day');
        return `${formatTime(event.date, {timeOnly: true})} – ${formatTime(event.end, {timeOnly: true})}`;
    }

    _reload() {
        try {
            this._reloadEvents();
        } finally {
            // Include loading/empty states and newly created event labels.
            this._applyTextColors();
        }
    }

    _reloadEvents() {
        // Drop references before destroy_all_children() disposes their actors.
        this._liveBackdrops = [];
        this._eventsList.destroy_all_children();
        this._title.text = this._dayTitle();

        if (!this._eventSource || this._eventSource.isLoading) {
            this._timeline.setEvents(this._day, []);
            this._timeline.hide();
            this._rangeLabels.hide();
            this._count.text = _('Loading…');
            this._addPlaceholder(_('Loading events…'));
            return;
        }

        const end = new Date(this._day.getFullYear(), this._day.getMonth(), this._day.getDate() + 1);
        const events = this._eventSource.getEvents(this._day, end);
        const timedCount = events.filter(event => !isAllDay(event)).length;
        // Translators: first number is timed events, second is all events.
        this._count.text = _('%d timed · %d total').format(timedCount, events.length);
        this._timeline.setEvents(this._day, events);
        const showTimeline = this._settings.get_boolean('show-timeline');
        this._timeline.visible = showTimeline;
        this._rangeLabels.visible = showTimeline;

        const [rangeStart, rangeMiddle, rangeEnd] = this._formatRange(events);
        this._rangeStart.text = rangeStart;
        this._rangeMiddle.text = rangeMiddle;
        this._rangeEnd.text = rangeEnd;

        if (events.length === 0) {
            this._addPlaceholder(_('No events'));
            this._sync();
            return;
        }

        const allDayEvents = events.filter(event => isAllDay(event));
        const timedEvents = events.filter(event => !isAllDay(event));
        const dimPastEvents = this._settings.get_boolean('dim-past-events');
        if (allDayEvents.length && this._settings.get_boolean('group-all-day-events'))
            this._addAllDayGroup(allDayEvents, dimPastEvents);
        else
            allDayEvents.forEach(event => this._addAllDayEvent(event, dimPastEvents));

        for (const event of timedEvents) {
            const ongoing = isOngoing(event);
            const past = dimPastEvents && !ongoing && isPast(event);
            const row = new St.Widget({
                style_class: `event-box splendid-agenda-event timed${ongoing ? ' ongoing' : ''}${past ? ' past' : ''}`,
                opacity: past ? PAST_EVENT_OPACITY : 255,
                layout_manager: new Clutter.BinLayout(),
                x_expand: true,
                clip_to_allocation: true,
            });
            if (ongoing) {
                const backdrop = new LiveEventBackdrop(event);
                this._liveBackdrops.push(backdrop);
                backdrop.connect('destroy', () => {
                    this._liveBackdrops = this._liveBackdrops.filter(item => item !== backdrop);
                });
                row.add_child(backdrop);
            }
            const rowContent = new St.BoxLayout({
                style_class: 'splendid-agenda-event-content',
                orientation: Clutter.Orientation.VERTICAL,
                x_expand: true,
                clip_to_allocation: true,
            });
            row.add_child(rowContent);
            const heading = new St.BoxLayout({x_expand: true, clip_to_allocation: true});
            const summary = new St.Label({
                text: event.summary,
                style_class: 'event-summary',
                x_expand: true,
                x_align: Clutter.ActorAlign.START,
            });
            summary.clutter_text.ellipsize = Pango.EllipsizeMode.END;
            summary.clutter_text.single_line_mode = true;
            const time = new St.Label({
                text: this._eventTime(event),
                style_class: 'event-time splendid-agenda-event-time',
                x_align: Clutter.ActorAlign.END,
                y_align: Clutter.ActorAlign.CENTER,
            });
            time.clutter_text.ellipsize = Pango.EllipsizeMode.END;
            time.clutter_text.single_line_mode = true;
            heading.add_child(summary);
            heading.add_child(time);
            rowContent.add_child(heading);
            if (ongoing) {
                const liveStatus = new St.BoxLayout({
                    style_class: 'splendid-agenda-live-status',
                    x_expand: true,
                });
                liveStatus.add_child(new St.Label({
                    text: _('Now'),
                    style_class: 'splendid-agenda-live-now',
                    x_expand: true,
                    x_align: Clutter.ActorAlign.START,
                }));
                liveStatus.add_child(new St.Label({
                    text: _('Ends in %s').format(timeUntilEnd(event, new Date(), ngettext)),
                    style_class: 'splendid-agenda-live-remaining',
                    x_align: Clutter.ActorAlign.END,
                }));
                rowContent.add_child(liveStatus);
            }
            this._eventsList.add_child(row);
        }
        this._sync();
    }

    _addAllDayGroup(events, dimPastEvents) {
        const past = dimPastEvents && events.every(event => isPast(event));
        const row = new St.BoxLayout({
            style_class: `event-box splendid-agenda-event all-day splendid-agenda-all-day-group${past ? ' past' : ''}`,
            opacity: past ? PAST_EVENT_OPACITY : 255,
            orientation: Clutter.Orientation.VERTICAL,
            x_expand: true,
            clip_to_allocation: true,
        });
        const heading = new St.BoxLayout({x_expand: true, clip_to_allocation: true});
        const title = new St.Label({
            text: ngettext('%d all-day event', '%d all-day events', events.length).format(events.length),
            style_class: 'event-summary',
            x_expand: true,
            x_align: Clutter.ActorAlign.START,
        });
        const marker = new St.Label({
            text: _('All day'),
            style_class: 'event-time splendid-agenda-event-time',
            x_align: Clutter.ActorAlign.END,
            y_align: Clutter.ActorAlign.CENTER,
        });
        heading.add_child(title);
        heading.add_child(marker);
        row.add_child(heading);

        const names = new St.Label({
            text: events.map(event => event.summary).join('  ·  '),
            style_class: 'event-time splendid-agenda-all-day-names',
            x_expand: true,
            x_align: Clutter.ActorAlign.START,
        });
        names.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        names.clutter_text.single_line_mode = true;
        row.add_child(names);
        this._eventsList.add_child(row);
    }

    _addAllDayEvent(event, dimPastEvents) {
        const past = dimPastEvents && isPast(event);
        const row = new St.BoxLayout({
            style_class: `event-box splendid-agenda-event all-day${past ? ' past' : ''}`,
            opacity: past ? PAST_EVENT_OPACITY : 255,
            x_expand: true,
            clip_to_allocation: true,
        });
        const summary = new St.Label({
            text: event.summary,
            style_class: 'event-summary',
            x_expand: true,
            x_align: Clutter.ActorAlign.START,
        });
        summary.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        summary.clutter_text.single_line_mode = true;
        row.add_child(summary);
        row.add_child(new St.Label({
            text: _('All day'),
            style_class: 'event-time splendid-agenda-event-time',
            x_align: Clutter.ActorAlign.END,
            y_align: Clutter.ActorAlign.CENTER,
        }));
        this._eventsList.add_child(row);
    }

    _addPlaceholder(text) {
        this._eventsList.add_child(new St.Label({
            text,
            style_class: 'event-placeholder',
        }));
    }

    _sync() {
        this.visible = Boolean(this._eventSource?.hasCalendars);
    }

    vfunc_clicked() {
        const apps = Gio.AppInfo.get_recommended_for_type('text/calendar');
        const preferred = Gio.AppInfo.get_default_for_type('text/calendar', false);
        const app = preferred && apps?.some(candidate => candidate.equal(preferred)) ? preferred : apps?.[0];
        if (app)
            app.launch([], global.create_app_launch_context(0, -1));
        Main.overview.hide();
        Main.panel.closeCalendar();
    }

    destroy() {
        if (this._timelineSignal) {
            this._settings.disconnect(this._timelineSignal);
            this._timelineSignal = 0;
        }
        if (this._pulseSignal) {
            this._settings.disconnect(this._pulseSignal);
            this._pulseSignal = 0;
        }
        if (this._settingsSignal) {
            this._settings.disconnect(this._settingsSignal);
            this._settingsSignal = 0;
        }
        if (this._dimPastSignal) {
            this._settings.disconnect(this._dimPastSignal);
            this._dimPastSignal = 0;
        }
        if (this._animationSource) {
            GLib.Source.remove(this._animationSource);
            this._animationSource = 0;
        }
        this._liveBackdrops = [];
        if (this._clockSource) {
            GLib.Source.remove(this._clockSource);
            this._clockSource = 0;
        }
        this._disconnectSource();
        super.destroy();
    }
});
