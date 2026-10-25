const DAY_MS = 86_400_000;
const COLORS = [
    [0.40, 0.85, 0.76],
    [0.62, 0.55, 1.00],
    [1.00, 0.62, 0.48],
    [0.39, 0.71, 0.96],
    [0.95, 0.78, 0.40],
    [0.93, 0.51, 0.76],
];

export function sameDay(first, second) {
    return first.getFullYear() === second.getFullYear() &&
        first.getMonth() === second.getMonth() &&
        first.getDate() === second.getDate();
}

function atMidnight(date) {
    return date.getHours() === 0 && date.getMinutes() === 0 &&
        date.getSeconds() === 0;
}

export function isAllDay(event) {
    const startDay = Date.UTC(
        event.date.getFullYear(), event.date.getMonth(), event.date.getDate()) / DAY_MS;
    const endDay = Date.UTC(
        event.end.getFullYear(), event.end.getMonth(), event.end.getDate()) / DAY_MS;
    return atMidnight(event.date) && atMidnight(event.end) &&
        endDay > startDay;
}

export function eventColor(event) {
    let hash = 0;
    for (const character of event.id ?? event.summary)
        hash = ((hash << 5) - hash + character.codePointAt(0)) | 0;
    return COLORS[Math.abs(hash) % COLORS.length];
}

export function isOngoing(event, now = new Date()) {
    return !isAllDay(event) && event.date <= now && now < event.end;
}

export function isPast(event, now = new Date()) {
    return event.end <= now;
}

export function timeUntilEnd(event, now = new Date(),
    ngettext = (singular, plural, count) => count === 1 ? singular : plural) {
    const minutes = Math.max(1, Math.ceil((event.end - now) / 60_000));
    if (minutes < 60)
        return ngettext('%d min', '%d mins', minutes).replace('%d', minutes);
    const hours = Math.ceil(minutes / 60);
    return ngettext('%d hr', '%d hrs', hours).replace('%d', hours);
}

export function timelineRange(day, events) {
    const start = new Date(day);
    start.setHours(8, 0, 0, 0);
    const end = new Date(day);
    end.setHours(17, 0, 0, 0);
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);

    for (const event of events.filter(event => !isAllDay(event))) {
        const eventEnd = new Date(Math.min(event.end.getTime(), nextDay.getTime()));
        if (eventEnd > end) {
            end.setTime(eventEnd.getTime());
            end.setMinutes(0, 0, 0);
            if (end < eventEnd)
                end.setHours(end.getHours() + 1);
        }
    }
    return [start, end];
}
