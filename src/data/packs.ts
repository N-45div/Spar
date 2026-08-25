export type Scenario = {
  id: string;
  title: string;
  brief: string;
  role: string;
  temperament: string;
  stakes: string;
  pressure: number;
};

export type Pack = {
  id: string;
  name: string;
  tagline: string;
  pro: boolean;
  scenarios: Scenario[];
};

export const PACKS: Pack[] = [
  {
    id: 'accountability',
    name: 'Accountability',
    tagline: 'The conversations every new manager has first.',
    pro: false,
    scenarios: [
      {
        id: 'missed-deadlines',
        title: 'Missed deadlines, third time',
        brief: 'The pattern is real, and they know it.',
        role: 'Direct report',
        temperament: 'Defensive',
        stakes: 'High',
        pressure: 2,
      },
      {
        id: 'silent-underperformer',
        title: 'The silent underperformer',
        brief: 'Great in 1:1s, invisible in delivery.',
        role: 'Direct report',
        temperament: 'Goes quiet',
        stakes: 'High',
        pressure: 2,
      },
      {
        id: 'quality-slipped',
        title: 'Quality slipped after the promotion',
        brief: 'They earned the title. The work stopped showing it.',
        role: 'Direct report',
        temperament: 'Deflects with humor',
        stakes: 'High',
        pressure: 2,
      },
    ],
  },
  {
    id: 'money',
    name: 'Money talks',
    tagline: 'Comp, raises, and the counter-offer nobody warned you about.',
    pro: true,
    scenarios: [
      {
        id: 'raise-you-cant-give',
        title: "The raise you can't give",
        brief: 'They deserve it. The budget says no. You say it.',
        role: 'Direct report',
        temperament: 'Defensive',
        stakes: 'Career-defining',
        pressure: 3,
      },
      {
        id: 'counter-offer',
        title: 'Counter-offer on the table',
        brief: 'They have another offer and want to know what you will do.',
        role: 'Direct report',
        temperament: 'Deflects with humor',
        stakes: 'Career-defining',
        pressure: 3,
      },
    ],
  },
  {
    id: 'edges',
    name: 'Sharp edges',
    tagline: 'Peers, your own manager, and the politics in between.',
    pro: true,
    scenarios: [
      {
        id: 'peer-credit',
        title: 'A peer taking credit for your work',
        brief: 'Same level, no authority, and everyone saw the slide.',
        role: 'Peer',
        temperament: 'Deflects with humor',
        stakes: 'High',
        pressure: 3,
      },
      {
        id: 'pushing-back-up',
        title: 'Pushing back on your manager',
        brief: 'The ask is wrong. Saying so costs something.',
        role: 'My manager',
        temperament: 'Defensive',
        stakes: 'High',
        pressure: 3,
      },
    ],
  },
  {
    id: 'hardest',
    name: 'The hardest ones',
    tagline: 'The conversations you rehearse because you have to.',
    pro: true,
    scenarios: [
      {
        id: 'letting-go',
        title: 'Letting someone go',
        brief: 'Clear, humane, and over in ten minutes.',
        role: 'Direct report',
        temperament: 'Goes quiet',
        stakes: 'Career-defining',
        pressure: 4,
      },
      {
        id: 'pip',
        title: 'The PIP conversation',
        brief: 'A last chance that has to sound like one.',
        role: 'Direct report',
        temperament: 'Explosive',
        stakes: 'Career-defining',
        pressure: 4,
      },
    ],
  },
];
