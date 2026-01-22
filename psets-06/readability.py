from cs50 import get_string

# Get text from user
text = get_string("Text: ")

letters = 0
words = 0
sentences = 0

# Count letters, words, sentences
for char in text:
    if char.isalpha():
        letters += 1
    elif char in [".", "!", "?"]:
        sentences += 1

# Words are separated by spaces
words = len(text.split())

# Compute L and S
L = (letters / words) * 100
S = (sentences / words) * 100

# Coleman-Liau index
index = round(0.0588 * L - 0.296 * S - 15.8)

# Output result
if index < 1:
    print("Before Grade 1")
elif index >= 16:
    print("Grade 16+")
else:
    print(f"Grade {index}")
