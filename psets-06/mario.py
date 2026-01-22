from cs50 import get_int

# Prompt user for height until valid
while True:
    height = get_int("Height: ")
    if 1 <= height <= 8:
        break

# Build the pyramids
for i in range(1, height + 1):
    # Left pyramid (right-aligned)
    spaces = height - i
    hashes = i

    print(" " * spaces + "#" * hashes + "  " + "#" * hashes)
