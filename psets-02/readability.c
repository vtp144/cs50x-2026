#include <cs50.h>
#include <ctype.h>
#include <math.h>
#include <stdio.h>
#include <string.h>

int main(void)
{
    // Prompt user for text
    string text = get_string("Text: ");

    int letters = 0;
    int words = 0;
    int sentences = 0;

    int length = strlen(text);

    // Count letters, words, sentences
    for (int i = 0; i < length; i++)
    {
        if (isalpha(text[i]))
        {
            letters++;
        }
        else if (text[i] == ' ')
        {
            words++;
        }
        else if (text[i] == '.' || text[i] == '!' || text[i] == '?')
        {
            sentences++;
        }
    }

    // Words = spaces + 1 (if text isn't empty)
    words++;

    // Calculate L and S
    float L = ((float) letters / words) * 100;
    float S = ((float) sentences / words) * 100;

    // Coleman-Liau index
    float index = 0.0588 * L - 0.296 * S - 15.8;

    int grade = round(index);

    // Output result
    if (grade < 1)
    {
        printf("Before Grade 1\n");
    }
    else if (grade >= 16)
    {
        printf("Grade 16+\n");
    }
    else
    {
        printf("Grade %i\n", grade);
    }
}
