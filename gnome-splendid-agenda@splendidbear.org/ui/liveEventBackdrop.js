import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

export const LiveEventBackdrop = GObject.registerClass(
class LiveEventBackdrop extends St.DrawingArea {
    _init(event) {
        super._init({style_class: 'splendid-agenda-live-backdrop', x_expand: true, y_expand: true});
        this._event = event;
        this.connect('repaint', () => this._draw());
        this.connect('style-changed', () => this.queue_repaint());
    }

    updateAnimation() {
        const row = this.get_parent();
        if (!row || !this.mapped)
            return;

        // Some St rendering paths use the top color for the entire border.
        // Animate all sides together so the rounded outline visibly pulses.
        if (St.Settings.get().enable_animations) {
            const {red, green, blue} = this.get_theme_node().get_foreground_color();
            const phase = GLib.get_monotonic_time() / 2_400_000 * Math.PI * 2;
            const alpha = (0.60 + Math.sin(phase) * 0.35).toFixed(3);
            const style = `border-color: rgba(${red}, ${green}, ${blue}, ${alpha});`;
            if (row.get_style() !== style)
                row.set_style(style);
        } else if (row.get_style()) {
            row.set_style(null);
        }
        this.queue_repaint();
    }

    _draw() {
        const context = this.get_context();
        const [width, height] = this.get_surface_size();
        const duration = this._event.end - this._event.date;
        const progress = duration > 0
            ? Math.max(0, Math.min(1, (Date.now() - this._event.date.getTime()) / duration))
            : 0;

        const color = this.get_theme_node().get_foreground_color();
        const rgb = [color.red, color.green, color.blue].map(component => component / 255);
        context.setSourceRGBA(...rgb, 0.13);
        context.rectangle(0, 0, width * progress, height);
        context.fill();

        context.$dispose();
    }
});
