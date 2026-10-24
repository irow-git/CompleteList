import { formatDay, fromUtcDay, toUtcDay } from "./dates"

// Run with TZ=... to check other time zones; the results must not change
test("a picked day round-trips through its UTC midnight", () => {
  const picked = new Date(2015, 4, 19)
  const stored = new Date("2015-05-19T00:00:00.000Z")

  expect(toUtcDay(picked)).toEqual(stored)
  expect(fromUtcDay(stored)).toEqual(picked)
  expect(formatDay(stored)).toBe("2015-May-19")
})

test("the time of day of the picked Date is ignored", () => {
  expect(toUtcDay(new Date(2021, 0, 31, 23, 59))).toEqual(new Date("2021-01-31T00:00:00.000Z"))
})
