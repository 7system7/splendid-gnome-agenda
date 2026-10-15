import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {AgendaSection} from './ui/agendaSection.js';

export default class GnomeSplendidAgendaExtension extends Extension {
    enable() {
        const dateMenu = Main.panel.statusArea.dateMenu;
        const original = dateMenu?._eventsItem;
        const parent = original?.get_parent();
        if (!dateMenu || !original || !parent || !dateMenu._calendar || !dateMenu._eventSource)
            throw new Error('The GNOME Shell date menu layout is not compatible with Splendid Agenda.');

        this._dateMenu = dateMenu;
        this._original = original;
        this._parent = parent;
        this._index = parent.get_children().indexOf(original);
        this._settings = this.getSettings();
        this._agenda = new AgendaSection(this._settings);

        parent.remove_child(original);
        parent.insert_child_at_index(this._agenda, this._index);
        dateMenu._eventsItem = this._agenda;
        this._agenda.setEventSource(dateMenu._eventSource);
        this._agenda.setDate(dateMenu._calendar._selectedDate ?? new Date());
    }

    disable() {
        if (!this._dateMenu)
            return;

        if (this._agenda?.get_parent())
            this._agenda.get_parent().remove_child(this._agenda);
        this._agenda?.destroy();

        if (this._original && this._parent && !this._original.get_parent())
            this._parent.insert_child_at_index(this._original, this._index);

        this._dateMenu._eventsItem = this._original;
        if (this._dateMenu._eventSource) {
            if (this._original._eventSource !== this._dateMenu._eventSource)
                this._original.setEventSource(this._dateMenu._eventSource);
            this._original.setDate(this._dateMenu._calendar._selectedDate ?? new Date());
        }

        this._agenda = null;
        this._original = null;
        this._parent = null;
        this._dateMenu = null;
        this._settings = null;
    }
}
