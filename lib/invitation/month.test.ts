import { expect, test } from 'vitest';
import { invitationMonth } from './month';
const date = (start: string, timezone='Asia/Tashkent') => ({locale:'ru' as const,date:{start,timezone,showCountdown:false}});
test('calendar uses the event timezone across a month and year boundary',()=>{
 const m=invitationMonth(date('2027-12-31T22:30:00Z'));expect([m.year,m.month,m.selected]).toEqual([2028,1,1]);expect(m.cells.indexOf(1)).toBe(5);expect(m.cells.filter(x=>x)).toHaveLength(31);
});
test('leap February and Monday-first weekdays align exactly',()=>{
 const m=invitationMonth(date('2028-02-29T18:00:00+05:00'));expect(m.cells.indexOf(1)).toBe(1);expect(m.cells.filter(x=>x)).toHaveLength(29);expect(m.weekdays).toEqual(['пн','вт','ср','чт','пт','сб','вс']);expect(m.cells[29]).toBe(29);
});
test('the couple date is marked on Sunday in February 2027',()=>{
 const m=invitationMonth(date('2027-02-28T18:23:00+05:00'));expect(m.cells).toHaveLength(28);expect(m.cells[27]).toBe(m.selected);expect(m.title).toMatch(/февраль.*2027/);
});
