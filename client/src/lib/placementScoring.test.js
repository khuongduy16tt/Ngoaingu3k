import { describe, expect, it } from 'vitest';
import { gradeSpeaking, gradeWriting } from './placementScoring';

// Bài mẫu viết theo đặc điểm điển hình của từng band (để kiểm tra bộ chấm cho
// điểm đúng thứ tự và trong khoảng hợp lý). Khi có bài do giáo viên chấm thật,
// thêm vào CALIBRATION bên dưới để đo độ lệch.

const TASK1_WEAK = `the table show metro in six city. new york have 24 lines and it is long 659 miles. london have 11 lines. tokyo have 13 lines. paris have 16 lines. mexico have 12 lines and beijing have 19 lines. the ticket of london is 7.30 it is very expensive. mexico ticket is cheap`;

const TASK1_MID = `The table shows information about the metro systems in six cities, including the number of lines, the total length, annual journeys and the price of a single ticket.

New York has the most lines with 24 and the longest system at 659 miles. Beijing has 19 lines and 357 miles, while Paris has 16 lines but only 127 miles. London has 11 lines and its system is 249 miles long.

In terms of journeys, Beijing and Tokyo have the highest numbers with 3.6 and 3.1 billion. The other cities have between 1.2 and 1.65 billion journeys every year. London has the most expensive ticket at $7.30, but Mexico City is the cheapest at $0.23.

Overall, New York has the biggest system but Beijing carries the most passengers.`;

const TASK1_GOOD = `The table compares six metro systems in terms of the number of lines, network length, annual passenger journeys and the cost of a single ticket.

Overall, it is clear that New York operates by far the largest network, whereas the Asian systems, particularly Beijing, carry considerably more passengers. Ticket prices vary significantly, with London being the most expensive and Mexico City the cheapest.

New York has 24 lines covering 659 miles, which is more than twice the length of London's 249-mile network. Beijing ranks second with 19 lines and 357 miles, while Paris, despite having 16 lines, has the shortest system at only 127 miles. Tokyo and Mexico City have similar numbers of lines, at 13 and 12 respectively.

Regarding usage, Beijing records the highest figure of 3.6 billion journeys annually, followed closely by Tokyo at 3.1 billion. By contrast, the remaining cities have between 1.2 and 1.65 billion journeys. A single ticket in London costs $7.30, roughly three times the price in New York ($2.50) and Paris ($2.30), whereas passengers in Mexico City and Beijing pay only $0.23 and $0.45 respectively.`;

const TASK2_WEAK = `stress is problem in many country. people have stress because work. work is very hard and boss is angry. people have stress because money. money is not enough. i think people should relax. people should play sport. people should sleep more. government should help people. this is my opinion about stress and i think stress is very bad for people and people should relax more and play sport and sleep and eat good food`;

const TASK2_MID = `Nowadays, more and more people suffer from stress in many countries. In this essay, I will discuss the causes of this problem and some measures to solve it.

Firstly, the main cause of stress is work. Many people have to work long hours and they have a lot of deadlines. Their boss always wants them to finish work quickly, so they feel a lot of pressure. Secondly, money is another reason. The cost of living is increasing, so people worry about paying for their house and their children's school.

There are some measures to tackle this problem. First, companies should reduce the workload of employees and give them more holidays. Second, people should do exercise and spend time with their family because it helps them relax. For example, my father plays football every weekend and he feels much better. Moreover, the government should build more parks so people can relax after work.

In conclusion, stress is caused by work and money problems. However, if companies, individuals and the government work together, this problem can be reduced.`;

const TASK2_GOOD = `In many countries, the number of people suffering from stress has risen considerably in recent years. This essay will examine the main causes of this trend and suggest several measures that individuals, employers and governments could take to tackle it.

The primary cause of stress is arguably the increasingly demanding nature of modern work. Employees are often expected to meet tight deadlines and remain contactable at all times, which blurs the boundary between their professional and personal lives. Furthermore, the rising cost of living places considerable financial pressure on families, particularly in large cities where housing is expensive. Social media also contributes to the problem, as people constantly compare themselves with others whose lives appear more successful.

Although these causes are complex, there are a number of practical solutions. Firstly, employers should promote a healthier work-life balance, for instance by introducing flexible working hours and discouraging emails outside office hours. Secondly, governments could invest in affordable mental health services and public facilities such as parks and sports centres, which encourage people to exercise and relax. Finally, individuals themselves need to recognise the warning signs of stress and limit the time they spend on their phones, especially before going to sleep.

In conclusion, the growth of stress is largely the result of excessive workloads, financial worries and the influence of social media. If employers, governments and individuals all take responsibility, it would be possible to reduce stress levels significantly and improve the overall wellbeing of society.`;

describe('gradeWriting', () => {
  it('chấm 0 khi bỏ trống', () => {
    expect(gradeWriting({ task1: '', task2: '' }).band).toBe(0);
  });

  it('xếp đúng thứ tự yếu < trung bình < khá', () => {
    const weak = gradeWriting({ task1: TASK1_WEAK, task2: TASK2_WEAK });
    const mid = gradeWriting({ task1: TASK1_MID, task2: TASK2_MID });
    const good = gradeWriting({ task1: TASK1_GOOD, task2: TASK2_GOOD });
    expect(weak.band).toBeLessThan(mid.band);
    expect(mid.band).toBeLessThan(good.band);
  });

  it('cho band trong khoảng hợp lý với từng mức bài', () => {
    expect(gradeWriting({ task1: TASK1_WEAK, task2: TASK2_WEAK }).band).toBeLessThanOrEqual(4.5);
    const mid = gradeWriting({ task1: TASK1_MID, task2: TASK2_MID }).band;
    expect(mid).toBeGreaterThanOrEqual(5);
    expect(mid).toBeLessThanOrEqual(6.5);
    expect(gradeWriting({ task1: TASK1_GOOD, task2: TASK2_GOOD }).band).toBeGreaterThanOrEqual(6.5);
  });

  it('phạt bài thiếu số từ', () => {
    const full = gradeWriting({ task1: TASK1_GOOD, task2: TASK2_GOOD });
    const halfTask2 = TASK2_GOOD.split('\n\n').slice(0, 2).join('\n\n');
    const short = gradeWriting({ task1: TASK1_GOOD, task2: halfTask2 });
    expect(short.task2.band).toBeLessThan(full.task2.band);
  });
});

const PART1 = [
  'Where are you from?',
  'What do you like most about your hometown?',
  'Has your hometown changed much in recent years?',
  'Would you like to live there in the future? Why or why not?'
];

function speakingAnswers(part1, part2, part3, { seconds = [20, 100, 40], confidence = 0.9 } = {}) {
  return [
    ...part1.map((transcript, index) => ({ part: 'Part 1', question: PART1[index % PART1.length], transcript, seconds: seconds[0], confidence })),
    { part: 'Part 2', question: 'Describe a trip', transcript: part2, seconds: seconds[1], confidence },
    ...part3.map((transcript) => ({ part: 'Part 3', question: 'Why do people enjoy travelling?', transcript, seconds: seconds[2], confidence }))
  ];
}

describe('gradeSpeaking', () => {
  it('chấm 0 khi gần như không nói', () => {
    expect(gradeSpeaking(speakingAnswers(['hello'], '', [])).band).toBe(0);
  });

  it('xếp đúng thứ tự yếu < khá', () => {
    const weak = gradeSpeaking(
      speakingAnswers(
        ['i from hanoi', 'um it is good', 'yes it change', 'yes i like'],
        'um i go to da nang with my family we go to beach it is good i like it um',
        ['because it is fun', 'family', 'um phone', 'yes good'],
        { seconds: [8, 40, 15], confidence: 0.65 }
      )
    );
    const good = gradeSpeaking(
      speakingAnswers(
        [
          'I come from Hanoi which is the capital of Vietnam and it is located in the north of the country',
          'What I like most is the food because there are so many street stalls selling delicious dishes such as pho and bun cha',
          'Yes it has changed significantly in recent years there are many more high rise buildings and the traffic has become much heavier',
          'I would definitely like to live there in the future because my family and friends are there although the air pollution is quite serious'
        ],
        'I would like to talk about a trip to Da Lat that I took with my university friends last summer. We travelled by coach and it took about eight hours. When we arrived we stayed in a small homestay surrounded by pine forests. During the trip we visited several waterfalls, went to the night market and tried a lot of local specialities. What made the trip so memorable was the atmosphere because the weather was cool and peaceful compared with the busy life in Hanoi. I think it was also the first time we had travelled together without our parents so we felt really independent.',
        [
          'I think people enjoy travelling because it gives them the opportunity to escape from their daily routine and experience different cultures which can be really refreshing',
          'In my opinion travelling with friends is more enjoyable for young people because they share similar interests whereas travelling with family is better for relaxation',
          'Technology has made travelling much more convenient for example we can book tickets online and use maps on our phones so we rarely get lost',
          'Although tourism can damage the environment I believe it has more advantages because it creates jobs and helps people understand other cultures'
        ],
        { seconds: [25, 110, 45], confidence: 0.93 }
      )
    );
    expect(weak.band).toBeLessThan(good.band);
    expect(weak.band).toBeLessThanOrEqual(4.5);
    expect(good.band).toBeGreaterThanOrEqual(6);
  });
});
