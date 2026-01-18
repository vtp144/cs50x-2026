#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

#define BLOCK_SIZE 512

int main(int argc, char *argv[])
{
    // Check for correct usage
    if (argc != 2)
    {
        printf("Usage: ./recover FILE\n");
        return 1;
    }

    // Open forensic image
    FILE *card = fopen(argv[1], "r");
    if (card == NULL)
    {
        printf("Could not open file.\n");
        return 1;
    }

    // Buffer to store 512 bytes at a time
    uint8_t buffer[BLOCK_SIZE];

    // File pointer for recovered JPEG
    FILE *img = NULL;

    // Counter for JPEG filenames
    int jpg_count = 0;

    // Filename buffer: "###.jpg" + null terminator
    char filename[8];

    // Read blocks until end of file
    while (fread(buffer, 1, BLOCK_SIZE, card) == BLOCK_SIZE)
    {
        // Check if block is the start of a JPEG
        if (buffer[0] == 0xff && buffer[1] == 0xd8 && buffer[2] == 0xff &&
            (buffer[3] & 0xf0) == 0xe0)
        {
            // If already writing a JPEG, close it
            if (img != NULL)
            {
                fclose(img);
            }

            // Create new JPEG filename
            sprintf(filename, "%03i.jpg", jpg_count);
            jpg_count++;

            // Open new JPEG file for writing
            img = fopen(filename, "w");
        }

        // If currently writing a JPEG, write the block
        if (img != NULL)
        {
            fwrite(buffer, 1, BLOCK_SIZE, img);
        }
    }

    // Close any remaining open files
    if (img != NULL)
    {
        fclose(img);
    }

    fclose(card);
    return 0;
}
