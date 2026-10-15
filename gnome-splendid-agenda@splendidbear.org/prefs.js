import Adw from 'gi://Adw';
import Gio from 'gi://Gio';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class GnomeSplendidAgendaPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage({
            title: _('Agenda'),
            icon_name: 'x-office-calendar-symbolic',
        });
        const group = new Adw.PreferencesGroup({
            title: _('Events'),
            description: _('Choose how events are presented in the clock menu.'),
        });
        const groupAllDayEvents = new Adw.SwitchRow({
            title: _('Group all-day events'),
            subtitle: _('Show all all-day events in one compact summary row'),
        });
        const dimPastEvents = new Adw.SwitchRow({
            title: _('Dim past events'),
            subtitle: _('De-emphasize events that have already ended'),
        });

        settings.bind(
            'group-all-day-events',
            groupAllDayEvents,
            'active',
            Gio.SettingsBindFlags.DEFAULT);
        settings.bind(
            'dim-past-events',
            dimPastEvents,
            'active',
            Gio.SettingsBindFlags.DEFAULT);

        group.add(groupAllDayEvents);
        group.add(dimPastEvents);
        const pulseOngoingEvents = new Adw.SwitchRow({
            title: _('Pulse ongoing event borders'),
            subtitle: _('Animate “Now” event borders when system animations are enabled'),
        });
        const showTimeline = new Adw.SwitchRow({
            title: _('Show availability line'),
            subtitle: _('Show the daily timeline and its time labels'),
        });
        settings.bind('pulse-ongoing-events', pulseOngoingEvents, 'active', Gio.SettingsBindFlags.DEFAULT);
        settings.bind('show-timeline', showTimeline, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(pulseOngoingEvents);
        group.add(showTimeline);
        page.add(group);
        window.add(page);
    }
}
