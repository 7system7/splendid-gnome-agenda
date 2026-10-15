import Adw from 'gi://Adw';
import Gio from 'gi://Gio';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class GnomeSplendidAgendaPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage({
            title: 'Agenda',
            icon_name: 'x-office-calendar-symbolic',
        });
        const group = new Adw.PreferencesGroup({
            title: 'Events',
            description: 'Choose how events are presented in the clock menu.',
        });
        const groupAllDayEvents = new Adw.SwitchRow({
            title: 'Group all-day events',
            subtitle: 'Show all all-day events in one compact summary row',
        });
        const dimPastEvents = new Adw.SwitchRow({
            title: 'Dim past events',
            subtitle: 'De-emphasize events that have already ended',
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
            title: 'Pulse ongoing event borders',
            subtitle: 'Animate “Now” event borders when system animations are enabled',
        });
        const showTimeline = new Adw.SwitchRow({
            title: 'Show availability line',
            subtitle: 'Show the daily timeline and its time labels',
        });
        settings.bind('pulse-ongoing-events', pulseOngoingEvents, 'active', Gio.SettingsBindFlags.DEFAULT);
        settings.bind('show-timeline', showTimeline, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(pulseOngoingEvents);
        group.add(showTimeline);
        page.add(group);
        window.add(page);
    }
}
