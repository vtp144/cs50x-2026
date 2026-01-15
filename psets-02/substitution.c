#include <cs50.h>
#include <ctype.h>
#include <stdio.h>
#include <string.h>

// Function prototypes
bool is_valid_key(string key);
char substitute(char c, string key);

int main(int argc, string argv[])
{
    // Check for exactly one command-line argument
    if (argc != 2)
    {
        printf("Usage: ./substitution key\n");
        return 1;
    }

    string key = argv[1];

    // Validate the key
    if (!is_valid_key(key))
    {
        printf("Key must contain 26 unique alphabetic characters.\n");
        return 1;
    }

    // Prompt user for plaintext
    string plaintext = get_string("plaintext: ");

    // Print ciphertext
    printf("ciphertext: ");

    for (int i = 0; i < strlen(plaintext); i++)
    {
        printf("%c", substitute(plaintext[i], key));
    }

    printf("\n");
    return 0;
}

// Check if key is valid
bool is_valid_key(string key)
{
    if (strlen(key) != 26)
    {
        return false;
    }

    bool seen[26] = {false};

    for (int i = 0; i < 26; i++)
    {
        if (!isalpha(key[i]))
        {
            return false;
        }

        int index = tolower(key[i]) - 'a';

        if (seen[index])
        {
            return false;
        }

        seen[index] = true;
    }

    return true;
}

// Substitute character using the key
char substitute(char c, string key)
{
    if (isupper(c))
    {
        return toupper(key[c - 'A']);
    }
    else if (islower(c))
    {
        return tolower(key[c - 'a']);
    }
    else
    {
        return c;
    }
}
