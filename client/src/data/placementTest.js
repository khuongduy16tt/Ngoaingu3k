// Bài test trình độ miễn phí ở trang /test (đề Full Test 1, đáp án theo Keys_full test 1).
// Cấu trúc: skills (Listening/Reading) → parts (Part/Passage) → groups (một khung hướng dẫn) → questions.
// Câu điền từ có "____" trong prompt — giao diện thay chỗ đó bằng ô nhập.
// File nghe + ảnh nằm trên Supabase Storage (bucket public exam-audio / exam-images).

export const placementTest = {
  "id": "full-test-1",
  "title": "Full Test 1 – Kiểm tra trình độ IELTS",
  "skills": [
    {
      "id": "listening",
      "title": "Listening",
      "durationMinutes": 40,
      "audioUrl": "https://yhycvbjambzxdrgmxrhr.supabase.co/storage/v1/object/public/exam-audio/exams/full-test-1-1793627391017/audio.mp3",
      "parts": [
        {
          "id": "l-part1",
          "title": "Part 1",
          "range": "1–10",
          "groups": [
            {
              "title": "Questions 1–4",
              "display": "letters",
              "instruction": "For each course, what action does the man at the college have to take? Choose A, B or C. You may choose any letter more than once.",
              "list": {
                "title": "Action required",
                "items": [
                  {
                    "code": "A",
                    "text": "post the customer something"
                  },
                  {
                    "code": "B",
                    "text": "check details with someone else"
                  },
                  {
                    "code": "C",
                    "text": "make changes to the information on the website"
                  }
                ]
              },
              "questions": [
                {
                  "id": "l1",
                  "number": 1,
                  "type": "multiple_choice",
                  "prompt": "Technology for Seniors",
                  "correctAnswer": "B – check details with someone else",
                  "options": [
                    "A – post the customer something",
                    "B – check details with someone else",
                    "C – make changes to the information on the website"
                  ]
                },
                {
                  "id": "l2",
                  "number": 2,
                  "type": "multiple_choice",
                  "prompt": "3D Printing",
                  "correctAnswer": "C – make changes to the information on the website",
                  "options": [
                    "A – post the customer something",
                    "B – check details with someone else",
                    "C – make changes to the information on the website"
                  ]
                },
                {
                  "id": "l3",
                  "number": 3,
                  "type": "multiple_choice",
                  "prompt": "Create Your Own Website",
                  "correctAnswer": "A – post the customer something",
                  "options": [
                    "A – post the customer something",
                    "B – check details with someone else",
                    "C – make changes to the information on the website"
                  ]
                },
                {
                  "id": "l4",
                  "number": 4,
                  "type": "multiple_choice",
                  "prompt": "Graphic Design",
                  "correctAnswer": "B – check details with someone else",
                  "options": [
                    "A – post the customer something",
                    "B – check details with someone else",
                    "C – make changes to the information on the website"
                  ]
                }
              ]
            },
            {
              "title": "Questions 5–10",
              "display": "form",
              "instruction": "Complete the form below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.",
              "heading": "Trent Town Community College – New student enrolment form",
              "questions": [
                {
                  "id": "l5",
                  "number": 5,
                  "type": "fill_blank",
                  "prompt": "Name: Emma ____",
                  "correctAnswer": "Steele",
                  "acceptedAnswers": [
                    "Steele"
                  ]
                },
                {
                  "id": "l6",
                  "number": 6,
                  "type": "fill_blank",
                  "prompt": "Home address: 3 ____ Road",
                  "correctAnswer": "River",
                  "acceptedAnswers": [
                    "River"
                  ]
                },
                {
                  "id": "l7",
                  "number": 7,
                  "type": "fill_blank",
                  "prompt": "Phone number: ____",
                  "correctAnswer": "07434 379 562",
                  "acceptedAnswers": [
                    "07434 379 562",
                    "07434379562"
                  ]
                },
                {
                  "id": "l8",
                  "number": 8,
                  "type": "fill_blank",
                  "prompt": "Email address: ____@cityhealth.cp",
                  "correctAnswer": "reception",
                  "acceptedAnswers": [
                    "reception"
                  ]
                },
                {
                  "id": "l9",
                  "number": 9,
                  "type": "fill_blank",
                  "prompt": "Course name: Graphic design\nCourse start date: ____",
                  "correctAnswer": "18 August",
                  "acceptedAnswers": [
                    "18 August",
                    "18th August",
                    "August 18",
                    "August 18th",
                    "18/8",
                    "18 Aug"
                  ]
                },
                {
                  "id": "l10",
                  "number": 10,
                  "type": "fill_blank",
                  "prompt": "When did the customer hear about the course? a ____",
                  "correctAnswer": "magazine article",
                  "acceptedAnswers": [
                    "magazine article",
                    "magazine",
                    "a magazine",
                    "a magazine article"
                  ]
                }
              ]
            }
          ]
        },
        {
          "id": "l-part2",
          "title": "Part 2",
          "range": "11–20",
          "groups": [
            {
              "title": "Questions 11–15",
              "display": "form",
              "instruction": "Complete the sentences below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.",
              "questions": [
                {
                  "id": "l11",
                  "number": 11,
                  "type": "fill_blank",
                  "prompt": "Keep your ____ in a safe place throughout your visit.",
                  "correctAnswer": "ticket",
                  "acceptedAnswers": [
                    "ticket",
                    "tickets"
                  ]
                },
                {
                  "id": "l12",
                  "number": 12,
                  "type": "fill_blank",
                  "prompt": "Pass through the ____ to enter and leave the museum.",
                  "correctAnswer": "grey gates",
                  "acceptedAnswers": [
                    "grey gates",
                    "gray gates"
                  ]
                },
                {
                  "id": "l13",
                  "number": 13,
                  "type": "fill_blank",
                  "prompt": "You need to buy a ____ if you want to use a camera in the museum.",
                  "correctAnswer": "permit",
                  "acceptedAnswers": [
                    "permit"
                  ]
                },
                {
                  "id": "l14",
                  "number": 14,
                  "type": "fill_blank",
                  "prompt": "Look after your ____ and mobile phone.",
                  "correctAnswer": "wallet",
                  "acceptedAnswers": [
                    "wallet"
                  ]
                },
                {
                  "id": "l15",
                  "number": 15,
                  "type": "fill_blank",
                  "prompt": "Arrive at the cinema about ____ before the start of the show.",
                  "correctAnswer": "five minutes",
                  "acceptedAnswers": [
                    "five minutes",
                    "5 minutes",
                    "5 mins",
                    "five mins"
                  ]
                }
              ]
            },
            {
              "title": "Questions 16–20",
              "display": "form",
              "instruction": "Complete the table below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.",
              "heading": "3D Film Choice",
              "questions": [
                {
                  "id": "l16",
                  "number": 16,
                  "type": "fill_blank",
                  "prompt": "The Secrets of the Nile · 10.00 a.m. · The first ____ along the river Nile",
                  "correctAnswer": "journey",
                  "acceptedAnswers": [
                    "journey"
                  ]
                },
                {
                  "id": "l17",
                  "number": 17,
                  "type": "fill_blank",
                  "prompt": "____ Ocean · 11.45 a.m. · Life at the bottom of the sea",
                  "correctAnswer": "Wild",
                  "acceptedAnswers": [
                    "Wild"
                  ]
                },
                {
                  "id": "l18",
                  "number": 18,
                  "type": "fill_blank",
                  "prompt": "Dinosaurs Alive · ____",
                  "correctAnswer": "1.45 p.m.",
                  "acceptedAnswers": [
                    "1.45 p.m.",
                    "1.45 pm",
                    "1:45 pm",
                    "1:45 p.m.",
                    "1.45",
                    "1:45",
                    "13:45",
                    "1.45pm",
                    "1:45pm"
                  ]
                },
                {
                  "id": "l19",
                  "number": 19,
                  "type": "fill_blank",
                  "prompt": "Dinosaurs Alive · A re-creation of a ____ of dinosaur",
                  "correctAnswer": "new species",
                  "acceptedAnswers": [
                    "new species"
                  ]
                },
                {
                  "id": "l20",
                  "number": 20,
                  "type": "fill_blank",
                  "prompt": "Arabia · 2.30 p.m. · A trip across the ____ and a dive in the Red Sea",
                  "correctAnswer": "desert",
                  "acceptedAnswers": [
                    "desert"
                  ]
                }
              ]
            }
          ]
        },
        {
          "id": "l-part3",
          "title": "Part 3",
          "range": "21–30",
          "groups": [
            {
              "title": "Questions 21–25",
              "display": "letters",
              "instruction": "Which feature applies to each of the following work experience opportunities with the National Parks Service? Choose FIVE answers from the box (A–G).",
              "list": {
                "title": "Work experience features",
                "items": [
                  {
                    "code": "A",
                    "text": "requires good interpersonal skills"
                  },
                  {
                    "code": "B",
                    "text": "not available during the winter"
                  },
                  {
                    "code": "C",
                    "text": "involves building maintenance"
                  },
                  {
                    "code": "D",
                    "text": "free accommodation is provided"
                  },
                  {
                    "code": "E",
                    "text": "involves research"
                  },
                  {
                    "code": "F",
                    "text": "training is provided"
                  },
                  {
                    "code": "G",
                    "text": "not available for individual applicants"
                  }
                ]
              },
              "questions": [
                {
                  "id": "l21",
                  "number": 21,
                  "type": "multiple_choice",
                  "prompt": "Custodial assistants",
                  "correctAnswer": "C – involves building maintenance",
                  "options": [
                    "A – requires good interpersonal skills",
                    "B – not available during the winter",
                    "C – involves building maintenance",
                    "D – free accommodation is provided",
                    "E – involves research",
                    "F – training is provided",
                    "G – not available for individual applicants"
                  ]
                },
                {
                  "id": "l22",
                  "number": 22,
                  "type": "multiple_choice",
                  "prompt": "Information assistants",
                  "correctAnswer": "A – requires good interpersonal skills",
                  "options": [
                    "A – requires good interpersonal skills",
                    "B – not available during the winter",
                    "C – involves building maintenance",
                    "D – free accommodation is provided",
                    "E – involves research",
                    "F – training is provided",
                    "G – not available for individual applicants"
                  ]
                },
                {
                  "id": "l23",
                  "number": 23,
                  "type": "multiple_choice",
                  "prompt": "Laboratory assistants",
                  "correctAnswer": "D – free accommodation is provided",
                  "options": [
                    "A – requires good interpersonal skills",
                    "B – not available during the winter",
                    "C – involves building maintenance",
                    "D – free accommodation is provided",
                    "E – involves research",
                    "F – training is provided",
                    "G – not available for individual applicants"
                  ]
                },
                {
                  "id": "l24",
                  "number": 24,
                  "type": "multiple_choice",
                  "prompt": "Resource assistants",
                  "correctAnswer": "E – involves research",
                  "options": [
                    "A – requires good interpersonal skills",
                    "B – not available during the winter",
                    "C – involves building maintenance",
                    "D – free accommodation is provided",
                    "E – involves research",
                    "F – training is provided",
                    "G – not available for individual applicants"
                  ]
                },
                {
                  "id": "l25",
                  "number": 25,
                  "type": "multiple_choice",
                  "prompt": "Landscape assistants",
                  "correctAnswer": "G – not available for individual applicants",
                  "options": [
                    "A – requires good interpersonal skills",
                    "B – not available during the winter",
                    "C – involves building maintenance",
                    "D – free accommodation is provided",
                    "E – involves research",
                    "F – training is provided",
                    "G – not available for individual applicants"
                  ]
                }
              ]
            },
            {
              "title": "Questions 26–30",
              "display": "letters",
              "instruction": "What do the speakers agree to do about each of the following topics for their presentation on flying insects? You may choose any letter more than once.",
              "list": {
                "title": "Topics for a presentation on flying insects",
                "items": [
                  {
                    "code": "A",
                    "text": "include it"
                  },
                  {
                    "code": "B",
                    "text": "leave it out"
                  },
                  {
                    "code": "C",
                    "text": "get advice"
                  }
                ]
              },
              "questions": [
                {
                  "id": "l26",
                  "number": 26,
                  "type": "multiple_choice",
                  "prompt": "Where they are found",
                  "correctAnswer": "A – include it",
                  "options": [
                    "A – include it",
                    "B – leave it out",
                    "C – get advice"
                  ]
                },
                {
                  "id": "l27",
                  "number": 27,
                  "type": "multiple_choice",
                  "prompt": "Equipment for catching them",
                  "correctAnswer": "C – get advice",
                  "options": [
                    "A – include it",
                    "B – leave it out",
                    "C – get advice"
                  ]
                },
                {
                  "id": "l28",
                  "number": 28,
                  "type": "multiple_choice",
                  "prompt": "Ways of identifying them",
                  "correctAnswer": "A – include it",
                  "options": [
                    "A – include it",
                    "B – leave it out",
                    "C – get advice"
                  ]
                },
                {
                  "id": "l29",
                  "number": 29,
                  "type": "multiple_choice",
                  "prompt": "Their value as a food source",
                  "correctAnswer": "B – leave it out",
                  "options": [
                    "A – include it",
                    "B – leave it out",
                    "C – get advice"
                  ]
                },
                {
                  "id": "l30",
                  "number": 30,
                  "type": "multiple_choice",
                  "prompt": "Their benefits for the environment",
                  "correctAnswer": "B – leave it out",
                  "options": [
                    "A – include it",
                    "B – leave it out",
                    "C – get advice"
                  ]
                }
              ]
            }
          ]
        },
        {
          "id": "l-part4",
          "title": "Part 4",
          "range": "31–40",
          "groups": [
            {
              "title": "Questions 31–32",
              "display": "letters",
              "instruction": "What are the TWO main concerns of an urban planner? Choose TWO letters, A–E.\nCâu 31 chọn chữ cái đứng trước, câu 32 chọn chữ cái đứng sau (theo thứ tự A→E).",
              "list": {
                "title": "Main concerns",
                "items": [
                  {
                    "code": "A",
                    "text": "appearance"
                  },
                  {
                    "code": "B",
                    "text": "city residents"
                  },
                  {
                    "code": "C",
                    "text": "function"
                  },
                  {
                    "code": "D",
                    "text": "budget"
                  },
                  {
                    "code": "E",
                    "text": "available time"
                  }
                ]
              },
              "questions": [
                {
                  "id": "l31",
                  "number": 31,
                  "type": "multiple_choice",
                  "prompt": "Đáp án thứ nhất",
                  "correctAnswer": "A – appearance",
                  "options": [
                    "A – appearance",
                    "B – city residents",
                    "C – function",
                    "D – budget",
                    "E – available time"
                  ]
                },
                {
                  "id": "l32",
                  "number": 32,
                  "type": "multiple_choice",
                  "prompt": "Đáp án thứ hai",
                  "correctAnswer": "C – function",
                  "options": [
                    "A – appearance",
                    "B – city residents",
                    "C – function",
                    "D – budget",
                    "E – available time"
                  ]
                }
              ]
            },
            {
              "title": "Questions 33–36",
              "display": "form",
              "instruction": "Complete the flow chart. Write NO MORE THAN THREE WORDS for each answer.",
              "heading": "Urban planning process",
              "image": "https://yhycvbjambzxdrgmxrhr.supabase.co/storage/v1/object/public/exam-images/exams/full-test-1-1793627391017/urban-planning-flowchart.jpg",
              "questions": [
                {
                  "id": "l33",
                  "number": 33,
                  "type": "fill_blank",
                  "prompt": "The vision is identified and ____ are selected.",
                  "correctAnswer": "goals",
                  "acceptedAnswers": [
                    "goals"
                  ]
                },
                {
                  "id": "l34",
                  "number": 34,
                  "type": "fill_blank",
                  "prompt": "Data is gathered and interpreted. The first draft of the plan is written and then ____.",
                  "correctAnswer": "revised",
                  "acceptedAnswers": [
                    "revised"
                  ]
                },
                {
                  "id": "l35",
                  "number": 35,
                  "type": "fill_blank",
                  "prompt": "Draft 2 is presented to ____ and draft 3 is written.",
                  "correctAnswer": "a planning team",
                  "acceptedAnswers": [
                    "a planning team",
                    "planning team",
                    "the planning team"
                  ]
                },
                {
                  "id": "l36",
                  "number": 36,
                  "type": "fill_blank",
                  "prompt": "The final draft is written and presented to ____ at the city council.",
                  "correctAnswer": "key decision-makers",
                  "acceptedAnswers": [
                    "key decision-makers",
                    "decision-makers",
                    "key decision makers",
                    "decision makers",
                    "the key decision-makers",
                    "the decision-makers"
                  ]
                }
              ]
            },
            {
              "title": "Questions 37–40",
              "display": "form",
              "instruction": "Complete the summary below. Write NO MORE THAN ONE WORD for each answer.",
              "questions": [
                {
                  "id": "l37",
                  "number": 37,
                  "type": "fill_blank",
                  "prompt": "Urban planning can be difficult for three key reasons. The first is that much of a town or city belongs to ____ and not local government, taking control out of their hands.",
                  "correctAnswer": "individuals",
                  "acceptedAnswers": [
                    "individuals"
                  ]
                },
                {
                  "id": "l38",
                  "number": 38,
                  "type": "fill_blank",
                  "prompt": "The second issue is the impact of ____ planning decisions, such as roads which are too narrow for today’s cars.",
                  "correctAnswer": "past",
                  "acceptedAnswers": [
                    "past"
                  ]
                },
                {
                  "id": "l39",
                  "number": 39,
                  "type": "fill_blank",
                  "prompt": "Finally, a planner has to ____ the needs of a future population.",
                  "correctAnswer": "predict",
                  "acceptedAnswers": [
                    "predict"
                  ]
                },
                {
                  "id": "l40",
                  "number": 40,
                  "type": "fill_blank",
                  "prompt": "So, although being a planner can be ____, it is also very challenging.",
                  "correctAnswer": "exciting",
                  "acceptedAnswers": [
                    "exciting"
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "reading",
      "title": "Reading",
      "durationMinutes": 60,
      "parts": [
        {
          "id": "r-part1",
          "title": "Passage 1",
          "range": "1–14",
          "passage": {
            "title": "The mysterious origins of flight",
            "paragraphs": [
              {
                "label": "A",
                "text": "Flight has been the dream of humankind since birds were seen in the sky. But it wasn't until the 1780s that two Frenchmen flew in a hot air balloon near Paris. After that, powered flight became the goal. Although it was thought that flight was possible as early as the 13th century, and in the 16th century Leonardo da Vinci drew designs which looked like aircraft, it wasn't until the Wright brothers made their first successful flights in Kitty Hawk in 1903 that powered flight became a reality."
              },
              {
                "label": "B",
                "text": "That's what historians have always believed. However, a small minority of researchers and scientists have re-examined historical objects and have found evidence to suggest that humans achieved flight earlier than the 20th century. They argue that flight was discovered long ago, but the knowledge of the technology was lost."
              },
              {
                "label": "C",
                "text": "A strange flying object was found in 1898 in a tomb at Saqquara, Egypt and was later dated to around 200 BCE. As aeroplanes had not been 'invented' in the late 19th century when the object was found, it was stored in a box marked 'wooden bird model' in the museum of Cairo. The object was later re-discovered by Dr Khalil Messiha, who considered the object so important that a special committee of leading scientists was established to study the object. As a result of their findings, the object was displayed in the museum of Cairo as a 'model aeroplane'."
              },
              {
                "label": "",
                "text": "The scientists found that the model was a very advanced form of glider, which will stay in the air almost by itself. The curved shape and size of the glider's wings are behind its ability to fly; a similar type of curved wing can be seen on Concorde and gave the plane maximum 'lift' without a reduction in speed."
              },
              {
                "label": "D",
                "text": "Admittedly, it is difficult to believe that a flying device with such advanced features was invented more than 2,000 years ago; historians insist that aeroplanes did not exist in those times. But this object seems to suggest otherwise, despite the refusal of unimaginative science to accept the evidence."
              },
              {
                "label": "E",
                "text": "Gold trinkets discovered in Central America and coastal areas of South America are further evidence of early flight. Estimated to belong to a period between 500 and 800 CE, these objects look very like modern aircraft or even spacecraft. The archaeologists who discovered them labelled these objects as zoomorphic, meaning 'animal shaped', but it is unclear which animal they represent. In fact, the structures on the objects look more mechanical, like the parts on an aeroplane. Photos of the objects were analysed by several experts. One of them was Arthur Young, a designer of Bell helicopters and other aircraft. His analysis confirmed that the object contains many features which would fit the aeroplane theory."
              },
              {
                "label": "F",
                "text": "In other cultures, flying vehicles are written about in early texts, such as the Indian epic, the Mahabharata and other books such as Bhagavata Purana and Ramayana. The flying devices were called vimanas and were discussed in Vaimanika Shastra, describing flying machines with different purposes and capabilities. The Book of Enoch not only describes flying machines but also spacecraft. There is no shortage of descriptions of flying machines in ancient sources. If we examine them in detail, we discover to our surprise that flying in ancient times seems to be the rule, not the exception."
              }
            ]
          },
          "groups": [
            {
              "title": "Questions 1–6",
              "display": "letters",
              "instruction": "Reading Passage 1 has six paragraphs, A–F. Choose the correct heading for each paragraph from the list of headings below.",
              "list": {
                "title": "List of headings",
                "items": [
                  {
                    "code": "i",
                    "text": "20th century flight"
                  },
                  {
                    "code": "ii",
                    "text": "Refusing to accept the evidence"
                  },
                  {
                    "code": "iii",
                    "text": "Is it a bird… or a plane?"
                  },
                  {
                    "code": "iv",
                    "text": "Re-writing history"
                  },
                  {
                    "code": "v",
                    "text": "Further evidence of early flight"
                  },
                  {
                    "code": "vi",
                    "text": "Written description of ancient flight"
                  },
                  {
                    "code": "vii",
                    "text": "The first powered planes"
                  },
                  {
                    "code": "ix",
                    "text": "A brief history of flight"
                  }
                ]
              },
              "questions": [
                {
                  "id": "r1",
                  "number": 1,
                  "type": "multiple_choice",
                  "prompt": "Paragraph A",
                  "correctAnswer": "ix – A brief history of flight",
                  "options": [
                    "i – 20th century flight",
                    "ii – Refusing to accept the evidence",
                    "iii – Is it a bird… or a plane?",
                    "iv – Re-writing history",
                    "v – Further evidence of early flight",
                    "vi – Written description of ancient flight",
                    "vii – The first powered planes",
                    "ix – A brief history of flight"
                  ]
                },
                {
                  "id": "r2",
                  "number": 2,
                  "type": "multiple_choice",
                  "prompt": "Paragraph B",
                  "correctAnswer": "iv – Re-writing history",
                  "options": [
                    "i – 20th century flight",
                    "ii – Refusing to accept the evidence",
                    "iii – Is it a bird… or a plane?",
                    "iv – Re-writing history",
                    "v – Further evidence of early flight",
                    "vi – Written description of ancient flight",
                    "vii – The first powered planes",
                    "ix – A brief history of flight"
                  ]
                },
                {
                  "id": "r3",
                  "number": 3,
                  "type": "multiple_choice",
                  "prompt": "Paragraph C",
                  "correctAnswer": "iii – Is it a bird… or a plane?",
                  "options": [
                    "i – 20th century flight",
                    "ii – Refusing to accept the evidence",
                    "iii – Is it a bird… or a plane?",
                    "iv – Re-writing history",
                    "v – Further evidence of early flight",
                    "vi – Written description of ancient flight",
                    "vii – The first powered planes",
                    "ix – A brief history of flight"
                  ]
                },
                {
                  "id": "r4",
                  "number": 4,
                  "type": "multiple_choice",
                  "prompt": "Paragraph D",
                  "correctAnswer": "ii – Refusing to accept the evidence",
                  "options": [
                    "i – 20th century flight",
                    "ii – Refusing to accept the evidence",
                    "iii – Is it a bird… or a plane?",
                    "iv – Re-writing history",
                    "v – Further evidence of early flight",
                    "vi – Written description of ancient flight",
                    "vii – The first powered planes",
                    "ix – A brief history of flight"
                  ]
                },
                {
                  "id": "r5",
                  "number": 5,
                  "type": "multiple_choice",
                  "prompt": "Paragraph E",
                  "correctAnswer": "v – Further evidence of early flight",
                  "options": [
                    "i – 20th century flight",
                    "ii – Refusing to accept the evidence",
                    "iii – Is it a bird… or a plane?",
                    "iv – Re-writing history",
                    "v – Further evidence of early flight",
                    "vi – Written description of ancient flight",
                    "vii – The first powered planes",
                    "ix – A brief history of flight"
                  ]
                },
                {
                  "id": "r6",
                  "number": 6,
                  "type": "multiple_choice",
                  "prompt": "Paragraph F",
                  "correctAnswer": "vi – Written description of ancient flight",
                  "options": [
                    "i – 20th century flight",
                    "ii – Refusing to accept the evidence",
                    "iii – Is it a bird… or a plane?",
                    "iv – Re-writing history",
                    "v – Further evidence of early flight",
                    "vi – Written description of ancient flight",
                    "vii – The first powered planes",
                    "ix – A brief history of flight"
                  ]
                }
              ]
            },
            {
              "title": "Questions 7–14",
              "display": "choices",
              "instruction": "Do the following statements agree with the information given in Reading Passage 1?",
              "legend": [
                [
                  "TRUE",
                  "if the statement agrees with the information"
                ],
                [
                  "FALSE",
                  "if the statement contradicts the information"
                ],
                [
                  "NOT GIVEN",
                  "if there is no information on this"
                ]
              ],
              "questions": [
                {
                  "id": "r7",
                  "number": 7,
                  "type": "multiple_choice",
                  "prompt": "Powered flight was invented by the French in the late eighteenth century.",
                  "correctAnswer": "FALSE",
                  "options": [
                    "TRUE",
                    "FALSE",
                    "NOT GIVEN"
                  ]
                },
                {
                  "id": "r8",
                  "number": 8,
                  "type": "multiple_choice",
                  "prompt": "Most scientists believe that flight was discovered earlier than the 20th century.",
                  "correctAnswer": "FALSE",
                  "options": [
                    "TRUE",
                    "FALSE",
                    "NOT GIVEN"
                  ]
                },
                {
                  "id": "r9",
                  "number": 9,
                  "type": "multiple_choice",
                  "prompt": "Dr Khalil Messiha found the model aeroplane in an Egyptian tomb.",
                  "correctAnswer": "FALSE",
                  "options": [
                    "TRUE",
                    "FALSE",
                    "NOT GIVEN"
                  ]
                },
                {
                  "id": "r10",
                  "number": 10,
                  "type": "multiple_choice",
                  "prompt": "Scientists compared the Egyptian model aeroplane’s wings to those of Concorde.",
                  "correctAnswer": "NOT GIVEN",
                  "options": [
                    "TRUE",
                    "FALSE",
                    "NOT GIVEN"
                  ]
                },
                {
                  "id": "r11",
                  "number": 11,
                  "type": "multiple_choice",
                  "prompt": "Science is open-minded about the possibility of early flying machines.",
                  "correctAnswer": "FALSE",
                  "options": [
                    "TRUE",
                    "FALSE",
                    "NOT GIVEN"
                  ]
                },
                {
                  "id": "r12",
                  "number": 12,
                  "type": "multiple_choice",
                  "prompt": "The gold objects were originally believed to be models of animals.",
                  "correctAnswer": "TRUE",
                  "options": [
                    "TRUE",
                    "FALSE",
                    "NOT GIVEN"
                  ]
                },
                {
                  "id": "r13",
                  "number": 13,
                  "type": "multiple_choice",
                  "prompt": "Arthur Young built a life-sized aeroplane based on the South American models.",
                  "correctAnswer": "NOT GIVEN",
                  "options": [
                    "TRUE",
                    "FALSE",
                    "NOT GIVEN"
                  ]
                },
                {
                  "id": "r14",
                  "number": 14,
                  "type": "multiple_choice",
                  "prompt": "Evidence of early flight can be found in old books.",
                  "correctAnswer": "TRUE",
                  "options": [
                    "TRUE",
                    "FALSE",
                    "NOT GIVEN"
                  ]
                }
              ]
            }
          ]
        },
        {
          "id": "r-part2",
          "title": "Passage 2",
          "range": "15–27",
          "passage": {
            "title": "The Real Price of Gold",
            "paragraphs": [
              {
                "label": "",
                "text": "Like many of his Inca ancestors, Juan Apaza spends every day digging for gold. For 30 days each month Apaza works, without pay, deep inside a mine above the world's highest town, La Rinconada. For 30 days he faces terrible dangers - explosions, poisonous gases, tunnel collapses - to find the gold that the world demands. Apaza does all this, without pay, so that he can spend the 31st day of the month taking as much rock as he can carry from the mine for himself. This rock may contain a lot of gold which could make Apaza a very wealthy man, but it may be completely worthless. But unbelievably, Apaza and his fellow miners want to take that risk. 'It's a cruel lottery,' says Apaza. 'But at least it gives us hope.'"
              },
              {
                "label": "",
                "text": "For more than 500 years the dream of gold has attracted people to this place in Peru. The first were the Inca, then the Spanish, whose search for gold and silver led them to take over the New World. But it is only now, as the price of gold increases dramatically - it has risen 235 percent in the past eight years - that 30,000 people have come to La Rinconada, turning this once quiet village into a horribly polluted town on top of the world. La Rinconada is not a pleasant place to live in or to visit. During my time here, I feared for my health and safety. La Rinconada has few basic services: no piped water, no pollution control, no postal service, not even a police station. It's a dangerous place, where no law is respected."
              },
              {
                "label": "",
                "text": "The dirt and rubbish on the overcrowded streets are small problems compared with the tons of poisonous mercury released during the process of separating gold from rock. According to Peruvian environmentalists, the mercury released at La Rinconada and the nearby mining town of Ananea is poisoning rivers and lakes down to the coast of Lake Titicaca, more than a hundred miles away."
              },
              {
                "label": "",
                "text": "Admittedly, gold mines do have a few advantages: they can bring jobs, technologies, and development to poor areas. Gold mining, however, wastes more energy per ounce than any other metal. To mine a single ounce of gold - the amount in a typical wedding ring - requires the removal of more than 250 tons of rock. Yet the public continue to buy it even though the price of gold is rising dramatically. Jewellery shops are, without doubt, partly to blame. They are responsible for two-thirds of the demand for gold, and made $53.5 billion in worldwide sales last year. Disappointingly, the origin of the gold and the damage caused by gold mining doesn't seem to concern them. Despite action groups trying to stop jewellery shops from selling gold from mines that cause serious damage, many countries which rely on the sale of gold to help the economy ignore the protests."
              },
              {
                "label": "",
                "text": "In many ways, people are interested in gold because there's not much of it. In all of history, only 161,000 tons of gold have been mined, only just enough to fill two Olympic-size swimming pools. More than half of that has been taken out of the ground in the past 50 years. Now the world's supplies of gold are quickly going down and new discoveries are rare. Most of the gold left is underground in far-off places which are often beauty spots. It's only a matter of time before these are discovered by the mining companies."
              }
            ]
          },
          "groups": [
            {
              "title": "Questions 15–18",
              "display": "options",
              "instruction": "Choose the correct letter, A, B, C or D.",
              "questions": [
                {
                  "id": "r15",
                  "number": 15,
                  "type": "multiple_choice",
                  "prompt": "Apaza works in the gold mine because",
                  "correctAnswer": "C – he could become rich one day.",
                  "options": [
                    "A – he needs a full-time job.",
                    "B – he earns a lot of money at the end of the month.",
                    "C – he could become rich one day.",
                    "D – his family have always worked in a mine."
                  ]
                },
                {
                  "id": "r16",
                  "number": 16,
                  "type": "multiple_choice",
                  "prompt": "The most serious problem described in La Rinconada is",
                  "correctAnswer": "C – the poison released into the water.",
                  "options": [
                    "A – the increase in the price of gold.",
                    "B – the over-crowded gold mining villages.",
                    "C – the poison released into the water.",
                    "D – the lack of facilities in La Rinconada."
                  ]
                },
                {
                  "id": "r17",
                  "number": 17,
                  "type": "multiple_choice",
                  "prompt": "Gold mining causes",
                  "correctAnswer": "B – energy to be wasted.",
                  "options": [
                    "A – poverty and unemployment.",
                    "B – energy to be wasted.",
                    "C – the price of gold to increase.",
                    "D – action groups to blame jewellers."
                  ]
                },
                {
                  "id": "r18",
                  "number": 18,
                  "type": "multiple_choice",
                  "prompt": "There is a shortage of gold because",
                  "correctAnswer": "C – a lot of it has been mined already.",
                  "options": [
                    "A – the gold is in protected areas.",
                    "B – people haven’t discovered where it is yet.",
                    "C – a lot of it has been mined already.",
                    "D – the gold is difficult to reach."
                  ]
                }
              ]
            },
            {
              "title": "Questions 19–22",
              "display": "choices",
              "instruction": "Do the following statements agree with the views of the writer in Reading Passage 2?",
              "legend": [
                [
                  "YES",
                  "if the statement agrees with the views of the writer"
                ],
                [
                  "NO",
                  "if the statement contradicts the views of the writer"
                ],
                [
                  "NOT GIVEN",
                  "if it is impossible to say what the writer thinks about this"
                ]
              ],
              "questions": [
                {
                  "id": "r19",
                  "number": 19,
                  "type": "multiple_choice",
                  "prompt": "The benefits of gold mining are greater than the drawbacks.",
                  "correctAnswer": "NO",
                  "options": [
                    "YES",
                    "NO",
                    "NOT GIVEN"
                  ]
                },
                {
                  "id": "r20",
                  "number": 20,
                  "type": "multiple_choice",
                  "prompt": "La Rinconada is not a pleasant place to live.",
                  "correctAnswer": "YES",
                  "options": [
                    "YES",
                    "NO",
                    "NOT GIVEN"
                  ]
                },
                {
                  "id": "r21",
                  "number": 21,
                  "type": "multiple_choice",
                  "prompt": "Jewellery shops shouldn’t sell gold.",
                  "correctAnswer": "YES",
                  "options": [
                    "YES",
                    "NO",
                    "NOT GIVEN"
                  ]
                },
                {
                  "id": "r22",
                  "number": 22,
                  "type": "multiple_choice",
                  "prompt": "Nature should be protected from miners.",
                  "correctAnswer": "NOT GIVEN",
                  "options": [
                    "YES",
                    "NO",
                    "NOT GIVEN"
                  ]
                }
              ]
            },
            {
              "title": "Questions 23–27",
              "display": "letters",
              "instruction": "Complete the summary using the list of words, A–I, below.",
              "summary": "Gold mining is a very (23) ____ and dirty business, both for the miners and for the (24) ____. Unfortunately, it’s also very profitable. As the supply of gold has decreased, the price of it has gone up, resulting in a higher demand for gold than ever before. (25) ____, in particular, are responsible for the increased demand. Although mining does create (26) ____ it also creates a lot of waste and (27) ____ which damages towns, water supplies and areas of natural beauty.",
              "list": {
                "title": "Word list",
                "items": [
                  {
                    "code": "A",
                    "text": "jewellers"
                  },
                  {
                    "code": "B",
                    "text": "employers"
                  },
                  {
                    "code": "C",
                    "text": "dangerous"
                  },
                  {
                    "code": "D",
                    "text": "miners' families"
                  },
                  {
                    "code": "E",
                    "text": "risk"
                  },
                  {
                    "code": "F",
                    "text": "improvement"
                  },
                  {
                    "code": "G",
                    "text": "environment"
                  },
                  {
                    "code": "H",
                    "text": "jobs"
                  },
                  {
                    "code": "I",
                    "text": "pollution"
                  }
                ]
              },
              "questions": [
                {
                  "id": "r23",
                  "number": 23,
                  "type": "multiple_choice",
                  "prompt": "Gap 23",
                  "correctAnswer": "C – dangerous",
                  "options": [
                    "A – jewellers",
                    "B – employers",
                    "C – dangerous",
                    "D – miners' families",
                    "E – risk",
                    "F – improvement",
                    "G – environment",
                    "H – jobs",
                    "I – pollution"
                  ]
                },
                {
                  "id": "r24",
                  "number": 24,
                  "type": "multiple_choice",
                  "prompt": "Gap 24",
                  "correctAnswer": "D – miners' families",
                  "options": [
                    "A – jewellers",
                    "B – employers",
                    "C – dangerous",
                    "D – miners' families",
                    "E – risk",
                    "F – improvement",
                    "G – environment",
                    "H – jobs",
                    "I – pollution"
                  ]
                },
                {
                  "id": "r25",
                  "number": 25,
                  "type": "multiple_choice",
                  "prompt": "Gap 25",
                  "correctAnswer": "A – jewellers",
                  "options": [
                    "A – jewellers",
                    "B – employers",
                    "C – dangerous",
                    "D – miners' families",
                    "E – risk",
                    "F – improvement",
                    "G – environment",
                    "H – jobs",
                    "I – pollution"
                  ]
                },
                {
                  "id": "r26",
                  "number": 26,
                  "type": "multiple_choice",
                  "prompt": "Gap 26",
                  "correctAnswer": "H – jobs",
                  "options": [
                    "A – jewellers",
                    "B – employers",
                    "C – dangerous",
                    "D – miners' families",
                    "E – risk",
                    "F – improvement",
                    "G – environment",
                    "H – jobs",
                    "I – pollution"
                  ]
                },
                {
                  "id": "r27",
                  "number": 27,
                  "type": "multiple_choice",
                  "prompt": "Gap 27",
                  "correctAnswer": "I – pollution",
                  "options": [
                    "A – jewellers",
                    "B – employers",
                    "C – dangerous",
                    "D – miners' families",
                    "E – risk",
                    "F – improvement",
                    "G – environment",
                    "H – jobs",
                    "I – pollution"
                  ]
                }
              ]
            }
          ]
        },
        {
          "id": "r-part3",
          "title": "Passage 3",
          "range": "28–40",
          "passage": {
            "title": "The history of chocolate",
            "paragraphs": [
              {
                "label": "A",
                "text": "The history of chocolate started in South America and the Amazon. Ancient man picked the sweet fruit off the trees and ate it, throwing away the seeds. The pod of the cacao tree tasted sweet, like apricots, whereas the beans - or seeds - inside the pod were bitter. It's not known when ancient civilizations found out how to use the cacao's seeds. It might have been by accident, when the beans fell into a fire and roasted, releasing a chocolate-like smell - however, the use of cacao beans as a food probably took place during the time of the Olmecs."
              },
              {
                "label": "B",
                "text": "The Olmecs (1200 to 300 BC) were an ancient tribe from South Central Mexico. They were the first to grow the cacao plant and use the beans. They had a name for these bitter seeds that held secrets to health and power: kakawa, or cacao."
              },
              {
                "label": "C",
                "text": "Following the Olmecs, the Mayans treasured cacao as a medicine and a food. But they did not make chocolate bars. Instead, the beans were mixed with corn and flavourings to make savoury meals. These dishes were very bitter - very different from the chocolate we eat now."
              },
              {
                "label": "D",
                "text": "Many years later, between the 14th and 16th centuries, the Aztecs used the cacao bean as their form of currency: in other words, beans were used like coins. A list of Aztec trading prices looked something like this:\n1 small rabbit = 30 cacao beans\n1 turkey egg = 3 cacao beans\n1 large tomato = 1 cacao bean"
              },
              {
                "label": "E",
                "text": "Christopher Columbus saw how the people of South America valued the beans, but he thought they were a type of nut - an almond. Although he brought cacao beans back to Spain with him nobody knew what they were or what to do with them."
              },
              {
                "label": "F",
                "text": "Then, in 1519, Hernan Cortes arrived at the great court of the Aztec king, Montezuma. He and his crew saw how the Aztecs used chocolate. Cortes himself didn't enjoy the Aztecs' bitter brew, but he recognized its value. He wrote to King Carlos I of Spain that chocolate was a 'drink that builds up resistance and fights fatigue'."
              },
              {
                "label": "G",
                "text": "After the Spanish conquered the Aztecs and began building settlements in the New World, they adopted many of the foods of the native people, including chocolate. European immigrants to the New World brought sugar and other foods to South and Central America, and the Spanish settlers began drinking chocolate hot and sweet."
              },
              {
                "label": "H",
                "text": "It took a royal wedding to make chocolate a star in Europe. When the Spanish princess, Maria Theresa, came to the French court at Versailles to marry King Louis XIV in 1660, she brought her precious cacao beans with her. Hot chocolate was served at the wedding and the bride's guests loved it. Although chocolate was expensive its popularity spread in France and England. Hot chocolate was served in 'chocolate houses,' not unlike the cafes you see on every street corner today."
              },
              {
                "label": "I",
                "text": "The 19th-century Industrial Revolution saw inventions that changed the nature of chocolate, particularly in Switzerland. For example, Swiss chemist Henri Nestle invented a process to create powdered milk, and together with Daniel Peter, a chocolate manufacturer, he created the very first milk chocolate bar in 1879. In the same year, Rudolphe Lindt invented the conche machine and the process known as 'conching' which made shiny, smooth and creamy chocolate. These advances made the Swiss the leaders of chocolate manufacturing, and throughout the 19th century they produced 12,000 pounds of chocolate per Swiss citizen per year, most of it for export."
              }
            ]
          },
          "groups": [
            {
              "title": "Questions 28–34",
              "display": "flow",
              "instruction": "Complete the flow chart. Choose NO MORE THAN TWO WORDS from the passage for each answer.",
              "heading": "The history of chocolate",
              "questions": [
                {
                  "id": "r28",
                  "number": 28,
                  "type": "fill_blank",
                  "prompt": "South America and the Amazon: ____ eaten but not beans.",
                  "correctAnswer": "pod",
                  "acceptedAnswers": [
                    "pod",
                    "pods",
                    "the pod"
                  ]
                },
                {
                  "id": "r29",
                  "number": 29,
                  "type": "fill_blank",
                  "prompt": "South Central Mexico: ____ the first to use the beans.",
                  "correctAnswer": "The Olmecs",
                  "acceptedAnswers": [
                    "The Olmecs",
                    "Olmecs"
                  ]
                },
                {
                  "id": "r30",
                  "number": 30,
                  "type": "fill_blank",
                  "prompt": "Mayans used beans in ____ dishes. (bitter, not sweet)",
                  "correctAnswer": "savoury",
                  "acceptedAnswers": [
                    "savoury",
                    "savory"
                  ]
                },
                {
                  "id": "r31",
                  "number": 31,
                  "type": "fill_blank",
                  "prompt": "Beans used as a type of ____ – to buy and sell things.",
                  "correctAnswer": "currency",
                  "acceptedAnswers": [
                    "currency"
                  ]
                },
                {
                  "id": "r32",
                  "number": 32,
                  "type": "fill_blank",
                  "prompt": "Spanish in New World started to drink ____ hot chocolate.",
                  "correctAnswer": "sweet",
                  "acceptedAnswers": [
                    "sweet"
                  ]
                },
                {
                  "id": "r33",
                  "number": 33,
                  "type": "fill_blank",
                  "prompt": "Chocolate introduced to Europe during a ____.",
                  "correctAnswer": "wedding",
                  "acceptedAnswers": [
                    "wedding",
                    "royal wedding"
                  ]
                },
                {
                  "id": "r34",
                  "number": 34,
                  "type": "fill_blank",
                  "prompt": "Hot chocolate drunk in ____.",
                  "correctAnswer": "chocolate houses",
                  "acceptedAnswers": [
                    "chocolate houses"
                  ]
                }
              ],
              "steps": {
                "r32": [
                  "Columbus brought cacao beans to Spain and Cortes recognized health properties.",
                  "Europeans brought sugar to the New World."
                ]
              }
            },
            {
              "title": "Questions 35–40",
              "display": "form",
              "instruction": "Complete the sentences below. Write NO MORE THAN THREE WORDS for each answer.",
              "questions": [
                {
                  "id": "r35",
                  "number": 35,
                  "type": "fill_blank",
                  "prompt": "Although the seeds of the cacao plant were bitter, the pod had a taste similar to ____.",
                  "correctAnswer": "apricots",
                  "acceptedAnswers": [
                    "apricots"
                  ]
                },
                {
                  "id": "r36",
                  "number": 36,
                  "type": "fill_blank",
                  "prompt": "Ancient civilizations may have discovered how to use the cacao’s seeds by ____.",
                  "correctAnswer": "accident",
                  "acceptedAnswers": [
                    "accident"
                  ]
                },
                {
                  "id": "r37",
                  "number": 37,
                  "type": "fill_blank",
                  "prompt": "To the Aztecs, one ____ was worth thirty cacao beans.",
                  "correctAnswer": "small rabbit",
                  "acceptedAnswers": [
                    "small rabbit",
                    "rabbit"
                  ]
                },
                {
                  "id": "r38",
                  "number": 38,
                  "type": "fill_blank",
                  "prompt": "Maria Theresa’s ____ enjoyed hot chocolate when she got married.",
                  "correctAnswer": "wedding guests",
                  "acceptedAnswers": [
                    "wedding guests",
                    "guests"
                  ]
                },
                {
                  "id": "r39",
                  "number": 39,
                  "type": "fill_blank",
                  "prompt": "Chocolate was popular in Europe, despite it being ____.",
                  "correctAnswer": "expensive",
                  "acceptedAnswers": [
                    "expensive"
                  ]
                },
                {
                  "id": "r40",
                  "number": 40,
                  "type": "fill_blank",
                  "prompt": "Switzerland was responsible for many of the ____ that redefined chocolate and they became leading chocolate manufacturers.",
                  "correctAnswer": "inventions",
                  "acceptedAnswers": [
                    "inventions"
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "writing",
      "title": "Writing",
      "durationMinutes": 60,
      "parts": [
        {
          "id": "w-task1",
          "title": "Task 1",
          "range": "≥150 từ",
          "minWords": 150,
          "suggestMinutes": 20,
          "groups": [],
          "writing": {
            "instruction": "You should spend about 20 minutes on this task.",
            "prompt": "The table shows information about metro systems in six different cities.\n\nSummarise the information by selecting and reporting the main features and make comparisons where relevant.",
            "image": "https://yhycvbjambzxdrgmxrhr.supabase.co/storage/v1/object/public/exam-images/exams/full-test-1-1793627391017/writing-task1-metro-table.png",
            "imageAlt": "Bảng thông tin hệ thống tàu điện ngầm của 6 thành phố"
          }
        },
        {
          "id": "w-task2",
          "title": "Task 2",
          "range": "≥250 từ",
          "minWords": 250,
          "suggestMinutes": 40,
          "groups": [],
          "writing": {
            "instruction": "You should spend about 40 minutes on this task.",
            "prompt": "Write about the following topic:\n\nIn many countries, the number of people suffering from stress is increasing.\n\nWhat do you think are the causes of this problem and what measures could be taken to tackle it?\n\nGive reasons for your answer and include any relevant examples from your own knowledge or experience."
          }
        }
      ]
    },
    {
      "id": "speaking",
      "title": "Speaking",
      "durationMinutes": 20,
      "parts": [
        {
          "id": "s-part1",
          "title": "Part 1",
          "range": "8 câu",
          "groups": [],
          "speaking": {
            "kind": "interview",
            "intro": "Introduction and Interview — trả lời ngắn gọn câu hỏi về bản thân (mỗi câu tối đa 30 giây).",
            "questions": [
              {
                "id": "s1-1",
                "text": "Where are you from?",
                "seconds": 30
              },
              {
                "id": "s1-2",
                "text": "What do you like most about your hometown?",
                "seconds": 30
              },
              {
                "id": "s1-3",
                "text": "Has your hometown changed much in recent years?",
                "seconds": 30
              },
              {
                "id": "s1-4",
                "text": "Would you like to live there in the future? Why or why not?",
                "seconds": 30
              },
              {
                "id": "s1-5",
                "text": "What do you usually do in your free time?",
                "seconds": 30
              },
              {
                "id": "s1-6",
                "text": "How often do you spend time with your friends?",
                "seconds": 30
              },
              {
                "id": "s1-7",
                "text": "Did you have the same hobbies when you were younger?",
                "seconds": 30
              },
              {
                "id": "s1-8",
                "text": "Do you think you will have more free time in the future?",
                "seconds": 30
              }
            ]
          }
        },
        {
          "id": "s-part2",
          "title": "Part 2",
          "range": "1 thẻ đề",
          "groups": [],
          "speaking": {
            "kind": "cue-card",
            "intro": "Individual Long Turn — có 1 phút chuẩn bị, sau đó nói 1–2 phút.",
            "prepSeconds": 60,
            "card": {
              "topic": "Describe a trip that you remember well.",
              "points": [
                "where you went",
                "who you went with",
                "what you did during the trip"
              ],
              "ending": "and explain why you remember this trip."
            },
            "questions": [
              {
                "id": "s2-1",
                "text": "Describe a trip that you remember well. You should say: where you went, who you went with, what you did during the trip, and explain why you remember this trip.",
                "seconds": 120
              }
            ]
          }
        },
        {
          "id": "s-part3",
          "title": "Part 3",
          "range": "8 câu",
          "groups": [],
          "speaking": {
            "kind": "discussion",
            "intro": "Discussion — thảo luận sâu hơn (mỗi câu tối đa 60 giây).",
            "questions": [
              {
                "id": "s3-1",
                "text": "Why do people enjoy travelling?",
                "seconds": 60
              },
              {
                "id": "s3-2",
                "text": "Do you think travelling is more enjoyable with family or friends?",
                "seconds": 60
              },
              {
                "id": "s3-3",
                "text": "How has technology changed the way people travel?",
                "seconds": 60
              },
              {
                "id": "s3-4",
                "text": "Do you think international tourism has more advantages than disadvantages?",
                "seconds": 60
              },
              {
                "id": "s3-5",
                "text": "How has technology changed the way people communicate?",
                "seconds": 60
              },
              {
                "id": "s3-6",
                "text": "Do you think children spend too much time using electronic devices?",
                "seconds": 60
              },
              {
                "id": "s3-7",
                "text": "What are the disadvantages of relying too much on technology?",
                "seconds": 60
              },
              {
                "id": "s3-8",
                "text": "Will technology make people's lives better in the future?",
                "seconds": 60
              }
            ]
          }
        }
      ]
    }
  ]
};

// Bảng quy đổi số câu đúng (/40) ra band IELTS Academic — dùng chung cho Listening và Reading.
export const BAND_TABLE = [
  [39, 9.0], [37, 8.5], [35, 8.0], [33, 7.5], [30, 7.0], [27, 6.5], [23, 6.0],
  [20, 5.5], [16, 5.0], [13, 4.5], [10, 4.0], [7, 3.5], [5, 3.0], [3, 2.5]
];

export function toBand(correct) {
  const row = BAND_TABLE.find(([min]) => correct >= min);
  return row ? row[1] : 0;
}
