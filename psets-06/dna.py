import csv
import sys


def main():

    # Check for correct command-line usage
    if len(sys.argv) != 3:
        print("Usage: python dna.py database.csv sequence.txt")
        sys.exit(1)

    # Read database file into a list of dictionaries
    database = []
    with open(sys.argv[1]) as file:
        reader = csv.DictReader(file)
        strs = reader.fieldnames[1:]  # STR names (exclude "name")
        for row in reader:
            database.append(row)

    # Read DNA sequence file into a string
    with open(sys.argv[2]) as file:
        sequence = file.read().strip()

    # Find longest match of each STR in the DNA sequence
    str_counts = {}
    for s in strs:
        str_counts[s] = longest_match(sequence, s)

    # Check database for matching profiles
    for person in database:
        match = True
        for s in strs:
            if int(person[s]) != str_counts[s]:
                match = False
                break
        if match:
            print(person["name"])
            return

    # If no match found
    print("No match")
    return


def longest_match(sequence, subsequence):
    """Returns length of longest run of subsequence in sequence."""

    longest_run = 0
    subsequence_length = len(subsequence)
    sequence_length = len(sequence)

    for i in range(sequence_length):

        count = 0

        while True:
            start = i + count * subsequence_length
            end = start + subsequence_length

            if sequence[start:end] == subsequence:
                count += 1
            else:
                break

        longest_run = max(longest_run, count)

    return longest_run


main()
