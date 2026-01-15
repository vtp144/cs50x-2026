#include <cs50.h>
#include <stdio.h>

int main(void)
{
    int height;

    // Prompt user for pyramid height until they give a valid number (1–8)
    do
    {
        height = get_int("Insert height: \n");
    }
    while (height < 1 || height > 8);

    // Loop through each row of the pyramid
    for (int row = 1; row <= height; row++)
    {
        // Print leading spaces so the pyramid is right-aligned
        for (int spaces = height - row; spaces > 0; spaces--)
        {
            printf(" ");
        }

        // Print hashes for the left pyramid
        for (int hash = 1; hash <= row; hash++)
        {
            printf("#");
        }

        // Print the gap between the two pyramids (always two spaces)
        printf("  ");

        // Print hashes for the right pyramid
        for (int hash = 1; hash <= row; hash++)
        {
            printf("#");
        }

        // Move to the next line after finishing the row
        printf("\n");
    }
}
