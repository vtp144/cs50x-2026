// Implements a dictionary's functionality

#include <ctype.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>

#include "dictionary.h"

// Number of buckets in hash table
// A larger number reduces collisions
#define N 65536

// Hash table node
typedef struct node
{
    char word[LENGTH + 1];
    struct node *next;
} node;

// Hash table
node *table[N];

// Word counter
unsigned int word_count = 0;

/**
 * Hashes word to a number between 0 and N - 1
 * Case-insensitive
 */
unsigned int hash(const char *word)
{
    unsigned long hash = 5381;

    for (int i = 0; word[i] != '\0'; i++)
    {
        hash = ((hash << 5) + hash) + tolower(word[i]);
    }

    return hash % N;
}

/**
 * Loads dictionary into memory
 */
bool load(const char *dictionary)
{
    FILE *file = fopen(dictionary, "r");
    if (file == NULL)
    {
        return false;
    }

    char word[LENGTH + 1];

    // Read words one by one
    while (fscanf(file, "%s", word) != EOF)
    {
        // Allocate memory for new node
        node *new_node = malloc(sizeof(node));
        if (new_node == NULL)
        {
            fclose(file);
            return false;
        }

        // Copy word into node
        strcpy(new_node->word, word);
        new_node->next = NULL;

        // Hash word
        unsigned int index = hash(word);

        // Insert node at head of linked list
        new_node->next = table[index];
        table[index] = new_node;

        word_count++;
    }

    fclose(file);
    return true;
}

/**
 * Returns true if word is in dictionary
 */
bool check(const char *word)
{
    unsigned int index = hash(word);

    node *cursor = table[index];

    // Traverse linked list
    while (cursor != NULL)
    {
        if (strcasecmp(cursor->word, word) == 0)
        {
            return true;
        }
        cursor = cursor->next;
    }

    return false;
}

/**
 * Returns number of words in dictionary
 */
unsigned int size(void)
{
    return word_count;
}

/**
 * Unloads dictionary from memory
 */
bool unload(void)
{
    for (int i = 0; i < N; i++)
    {
        node *cursor = table[i];

        while (cursor != NULL)
        {
            node *temp = cursor;
            cursor = cursor->next;
            free(temp);
        }

        table[i] = NULL;
    }

    return true;
}
