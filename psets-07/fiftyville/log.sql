-- Keep a log of any SQL queries you execute as you solve the mystery.

-- Find the crime scene report
SELECT * FROM crime_scene_reports
WHERE date = '2025-07-28' AND street = 'Humphrey Street';

-- Find cars leaving the bakery around the time of the theft
SELECT * FROM bakery_security_logs
WHERE date = '2025-07-28'
AND activity = 'exit';

-- Find short phone calls on the same day
SELECT * FROM phone_calls
WHERE date = '2025-07-28'
AND duration < 60;

-- Find the earliest flight out of Fiftyville on July 29
SELECT * FROM flights
WHERE origin_airport_id = (
    SELECT id FROM airports WHERE city = 'Fiftyville'
)
AND date = '2025-07-29'
ORDER BY hour, minute
LIMIT 1;
