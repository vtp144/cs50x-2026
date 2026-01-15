#include <cs50.h>
#include <stdio.h>

// Function prototypes
bool luhn_check(long number);
int count_digits(long number);
int get_start_digits(long number, int digits);

int main(void)
{
    long number = get_long("Number: ");

    // Step 1: Validate using Luhn's Algorithm
    if (!luhn_check(number))
    {
        printf("INVALID\n");
        return 0;
    }

    // Step 2: Determine card length
    int length = count_digits(number);

    // Step 3: Determine card type
    int first_two = get_start_digits(number, 2);
    int first_one = get_start_digits(number, 1);

    if (length == 15 && (first_two == 34 || first_two == 37))
    {
        printf("AMEX\n");
    }
    else if (length == 16 && (first_two >= 51 && first_two <= 55))
    {
        printf("MASTERCARD\n");
    }
    else if ((length == 13 || length == 16) && first_one == 4)
    {
        printf("VISA\n");
    }
    else
    {
        printf("INVALID\n");
    }
}

// Implements Luhn’s Algorithm
bool luhn_check(long number)
{
    int sum = 0;
    bool alternate = false;

    while (number > 0)
    {
        int digit = number % 10;

        if (alternate)
        {
            digit *= 2;
            sum += digit / 10 + digit % 10;
        }
        else
        {
            sum += digit;
        }

        alternate = !alternate;
        number /= 10;
    }

    return (sum % 10 == 0);
}

// Counts number of digits
int count_digits(long number)
{
    int count = 0;
    while (number > 0)
    {
        count++;
        number /= 10;
    }
    return count;
}

// Gets first n digits of the number
int get_start_digits(long number, int digits)
{
    while (count_digits(number) > digits)
    {
        number /= 10;
    }
    return number;
}
