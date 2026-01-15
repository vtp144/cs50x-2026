#include <cs50.h>
#include <stdio.h>

// Function prototypes
int calculate_quarters(int cents);
int calculate_dimes(int cents);
int calculate_nickels(int cents);
int calculate_pennies(int cents);

int main(void)
{
    int cents;

    // Prompt user for change owed
    do
    {
        cents = get_int("Change owed: ");
    }
    while (cents < 0);

    int coins = 0;

    // Calculate quarters
    int quarters = calculate_quarters(cents);
    coins += quarters;
    cents -= quarters * 25;

    // Calculate dimes
    int dimes = calculate_dimes(cents);
    coins += dimes;
    cents -= dimes * 10;

    // Calculate nickels
    int nickels = calculate_nickels(cents);
    coins += nickels;
    cents -= nickels * 5;

    // Calculate pennies
    int pennies = calculate_pennies(cents);
    coins += pennies;

    // Print total coins
    printf("%i\n", coins);
}

// Calculate number of quarters
int calculate_quarters(int cents)
{
    return cents / 25;
}

// Calculate number of dimes
int calculate_dimes(int cents)
{
    return cents / 10;
}

// Calculate number of nickels
int calculate_nickels(int cents)
{
    return cents / 5;
}

// Calculate number of pennies
int calculate_pennies(int cents)
{
    return cents;
}
