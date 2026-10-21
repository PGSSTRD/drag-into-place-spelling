

**Open Source Workshop**  
**“Drag Into Place” Interaction**  
**Specification Brief**

Curious Learning

Product Requirements for  
“Creating Literacy Games with React Native” workshop

Prepared by: Ben Burrage \<bburrage@curiouslearning.org\>

| DOCUMENT REVISION HISTORY *assign date stamp/sign off to accepted versions* |  |  |
| :---- | :---- | :---- |
| **Date** | **Version No** | **Author** |
| Apr. 11th, 2017 | V.1 | bburrage@curiouslearning.org |
|  |  |  |

# Glossary

### MVP

Minimum Viable Product. A small, testable piece of completed software that provides value to a user.

### Foils

Incorrect alternatives. 

# Project Difficulty and Information

This project’s difficulty rating is: Beginner / Intermediate

This project does not have an existing code base for reference.

This project must be completed using English-language content only.

# Purpose/objective

The pedagogical objective of the “Drag Into Place” interaction paradigm is to put order to a set of letters to spell a word. For example, combining the letters “C”, “A”, and “T” to spell “cat”.

# MVP Implementation

### UI Requirements

* Given a target word of length X, break the target word into X individual letters. Place the letters randomly on the screen of an unknown size.  
* An image area to display a pictorial representation of the word to spell.   
* An answer area, whose width is divided up into X spots (dependent on the length X of the target word), with which to drag letters into to form a completed word.

### Functional Requirements

* A child should be able to tap and drag letters around the screen.  
* When a letter is dragged into an answer area spot, the location of the dragged letter should be compared to the actual location of the letter within the target word.

	a.) If the letter is in the correct spot in the answer area:  
		\- Play a celebratory animation that provides positive visual feedback to the child.  
		\- Play an audio file pronouncing the letter in the context of the word.  
	b.) If the letter is NOT in the correct spot in the answer area:  
		\- Play a negative feedback audio file.  
		\- Bounce the letter to a random location in the UI.

* Once all letters have been placed correctly into the answer area:

	\- Play a celebration animation.  
	\- Play an audio file pronouncing the full word.  
	\- Choose a new target word and refresh the UI.

### Constraints

* A child should never be able to drag a letter off screen.  
* A child should not be able to tap and drag letters that are already correctly placed in the answer area.  
* All letters must be from the Roman alphabet.

### Input Requirements

* Your application should be able to read in a JSON file with a list of words to choose from for selecting a target word, the letters that make up that word, and the letters to use as foils.

### Provided Inputs

You will be given a JSON file which contains a list of words, foils, and letters.

The basic structure of the JSON will look something like:

// Target words we’d want the child to spell  
{  
“level\_id” : number, // a unique ID to identify the level  
	“target\_word” : string, // the word we are trying to spell  
	“letters” : char\[ \], // the letters composing the target word  
“foils” : char\[ \] // an incorrect list of letters  
}

###  Media Asset Considerations

In this app, a word will also have an association with:

* An image file path depicting that word.  
* A hint image sprite file path that shows where letters SHOULD go in sequence.  
* An audio file path saying the word.  
* Audio file paths for the pronunciation of each letter.  
* A celebratory animation to play when the word is spelled.

#  Better Implementation

### Additional UI Requirements

* As in the MVP implementation, given a target word of length X, break the target word into X individual letters but add Y foils, or incorrect letters, to the UI.  
* Foils should be read in from the JSON file.   
* A hint area should be created underneath the answer area to give the child a hint of what letter is supposed to go where in the answer area.

### Additional Functional Requirements

* If a foil is dragged to the answer area:

	\- Play a negative feedback audio file.  
	\- Animate the foil disappearing from the UI.  
	\- Reveal the hint letter image in the hint area for that particular letter spot.

#  Great Implementation

### Additional Functional Requirements

* Letters should no longer be statically placed in the UI. Instead, letters and foils should appear from the left of the screen, move to the right across the screen, and disappear off the right side of the screen within a set timeframe.  
* The child will have to tap a letter to stop it from moving across the screen and drag it to the answer area.

# 

# 

