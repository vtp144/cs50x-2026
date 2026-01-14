#include <cs50.h>
#include <ctype.h>
#include <stdio.h>
#include <string.h>

// Point values for A–Z
int POINTS[] = {1, 3, 3, 2, 1, 4, 2, 4, 1, 8, 5, 1, 3, 1, 1, 3, 10, 1, 1, 1, 1, 4, 4, 8, 4, 10};

// Function prototype
int compute_score(string word);

int main(void)
{
    // Get input from both players
    string player1 = get_string("Player 1: ");
    string player2 = get_string("Player 2: ");

    // Compute scores
    int score1 = compute_score(player1);
    int score2 = compute_score(player2);

    // Determine winner
    if (score1 > score2)
    {
        printf("Player 1 wins!\n");
    }
    else if (score2 > score1)
    {
        printf("Player 2 wins!\n");
    }
    else
    {
        printf("Tie!\n");
    }
}

// Compute Scrabble score for a word
int compute_score(string word)
{
    int score = 0;

    for (int i = 0; i < strlen(word); i++)
    {
        if (isalpha(word[i]))
        {
            char letter = toupper(word[i]);
            score += POINTS[letter - 'A'];
        }
    }

    return score;
}
