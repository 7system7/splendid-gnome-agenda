import assert from 'node:assert/strict';
import test from 'node:test';

import {
    eventColor, isAllDay, isOngoing, isPast, sameDay, timelineRange, timeUntilEnd,
} from '../gnome-splendid-agenda@splendidbear.org/utils/eventUtils.js';

const date = (day, hour = 0, minute = 0) => new Date(2026, 0, day, hour, minute);
const event = (start, end) => ({id: 'meeting', summary: 'Meeting', date: start, end});

test('sameDay compares calendar dates, not times', () => {
    assert.ok(sameDay(date(15), date(15, 23)));
    assert.ok(!sameDay(date(15), date(16)));
});

test('all-day detection requires midnight boundaries and full days', () => {
    assert.ok(isAllDay(event(date(15), date(16))));
    assert.ok(!isAllDay(event(date(15, 9), date(15, 10))));
    assert.ok(!isAllDay(event(date(15), date(15))));
});

test('ongoing and past status respect event boundaries', () => {
    const meeting = event(date(15, 9), date(15, 10));
    assert.ok(!isOngoing(meeting, date(15, 8)));
    assert.ok(isOngoing(meeting, date(15, 9)));
    assert.ok(!isPast(meeting, date(15, 9)));
    assert.ok(!isOngoing(meeting, date(15, 10)));
    assert.ok(isPast(meeting, date(15, 10)));
    assert.ok(!isOngoing(event(date(15), date(16)), date(15, 12)));
});

test('remaining time preserves minute and hour rounding', () => {
    const meeting = event(date(15, 9), date(15, 12));
    assert.equal(timeUntilEnd(meeting, date(15, 11, 59)), '1 min');
    assert.equal(timeUntilEnd(meeting, date(15, 11, 30)), '30 mins');
    assert.equal(timeUntilEnd(meeting, date(15, 11)), '1 hr');
    assert.equal(timeUntilEnd(meeting, date(15, 10, 59)), '2 hrs');
});

test('colors are stable and fall back to the event summary', () => {
    assert.deepEqual(eventColor({id: 'meeting'}), eventColor({summary: 'meeting'}));
});

test('remaining time translates units and passes the count to plural selection', () => {
    const meeting = event(date(15, 9), date(15, 12));
    const calls = [];
    const translate = (singular, plural, count) => {
        calls.push([singular, plural, count]);
        return singular === '%d min' ? '%d perc' : '%d óra';
    };
    assert.equal(timeUntilEnd(meeting, date(15, 11, 59), translate), '1 perc');
    assert.equal(timeUntilEnd(meeting, date(15, 11, 30), translate), '30 perc');
    assert.equal(timeUntilEnd(meeting, date(15, 10), translate), '2 óra');
    assert.deepEqual(calls, [
        ['%d min', '%d mins', 1],
        ['%d min', '%d mins', 30],
        ['%d hr', '%d hrs', 2],
    ]);
});

test('timeline defaults to 08:00–17:00 and ignores all-day events', () => {
    assert.deepEqual(timelineRange(date(15), []), [date(15, 8), date(15, 17)]);
    assert.deepEqual(timelineRange(date(15), [event(date(15), date(16))]),
        [date(15, 8), date(15, 17)]);
});

test('timeline rounds late events up and clips overnight events', () => {
    const day = date(15);
    const meeting = event(date(15, 16), date(15, 18, 15));
    assert.deepEqual(timelineRange(day, [meeting]), [date(15, 8), date(15, 19)]);
    assert.deepEqual(timelineRange(day, [event(date(15, 23), date(16, 2))]),
        [date(15, 8), date(16)]);
    assert.deepEqual(day, date(15));
    assert.deepEqual(meeting.end, date(15, 18, 15));
});
