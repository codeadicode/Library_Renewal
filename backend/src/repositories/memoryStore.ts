import bcrypt from 'bcryptjs';
import {
  User,
  Book,
  BookCopy,
  Loan,
  Reservation,
  RenewalAttempt,
  AcademicNeed,
  Topic,
  Course,
  Notification,
  FineLedger,
  LibraryPolicy,
  NotificationPreference,
} from '../types';
import {
  IUserRepository,
  IBookRepository,
  ILoanRepository,
  IReservationRepository,
  IRenewalAttemptRepository,
  IAcademicNeedRepository,
  INotificationRepository,
  IFineRepository,
  IPolicyRepository,
} from './interfaces';

export class MemoryStore {
  public users: Map<string, User> = new Map();
  public books: Map<string, Book> = new Map();
  public copies: Map<string, BookCopy> = new Map();
  public loans: Map<string, Loan> = new Map();
  public reservations: Map<string, Reservation> = new Map();
  public renewalAttempts: RenewalAttempt[] = [];
  public academicNeeds: Map<string, AcademicNeed> = new Map();
  public topics: Map<string, Topic> = new Map();
  public courses: Map<string, Course> = new Map();
  public notifications: Notification[] = [];
  public fines: FineLedger[] = [];
  public policy: LibraryPolicy;

  constructor() {
    this.policy = {
      id: 'policy-default',
      name: 'Standard Academic Borrowing Policy',
      maxRenewals: 2,
      loanPeriodDays: 14,
      renewalPeriodDays: 14,
      upcomingDays: 7,
      approachingMinDays: 4,
      approachingMaxDays: 7,
      urgentMaxDays: 3,
      finePerDay: 5.0,
      weightMetadata: 0.40,
      weightTfidf: 0.35,
      weightCourse: 0.15,
      weightLevel: 0.10,
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.seedDefaultData();
  }

  private seedDefaultData() {
    // Topics
    const topicsList: Topic[] = [
      { id: 't-norm', name: 'Database Normalisation' },
      { id: 't-sql', name: 'SQL' },
      { id: 't-ra', name: 'Relational Algebra' },
      { id: 't-tx', name: 'Transactions' },
      { id: 't-proc', name: 'Process Management' },
      { id: 't-mem', name: 'Memory Management' },
      { id: 't-fs', name: 'File Systems' },
      { id: 't-tcp', name: 'TCP/IP' },
      { id: 't-route', name: 'Routing' },
      { id: 't-sort', name: 'Sorting' },
      { id: 't-graph', name: 'Graph Algorithms' },
      { id: 't-dp', name: 'Dynamic Programming' },
      { id: 't-logic', name: 'Propositional Logic' },
      { id: 't-comb', name: 'Combinatorics' },
      { id: 't-arch', name: 'Instruction Set Architecture' },
      { id: 't-pipe', name: 'Pipelining' },
      { id: 't-search', name: 'Search' },
      { id: 't-ml', name: 'Supervised Learning' },
      { id: 't-nn', name: 'Neural Networks' },
      { id: 't-sec', name: 'Cryptography' },
      { id: 't-se', name: 'Requirements Engineering' },
      { id: 't-oo', name: 'Object-Oriented Design' },
      { id: 't-compile', name: 'Parsing' },
      { id: 't-lin', name: 'Linear Algebra' }, // Shared with ECE
      { id: 't-prob', name: 'Probability' },   // Shared with ECE

      // Core ECE Topics
      { id: 't-ss', name: 'Signals and Systems' },
      { id: 't-ft', name: 'Fourier and Z-Transforms' },
      { id: 't-analog', name: 'Analog Circuits and Op-Amps' },
      { id: 't-bjt', name: 'BJT and MOSFET Amplifiers' },
      { id: 't-digcomm', name: 'Digital Communication Systems' },
      { id: 't-dsp', name: 'Digital Signal Processing' },
      { id: 't-vlsi', name: 'CMOS VLSI Design' },
      { id: 't-em', name: 'Electromagnetics and Transmission Lines' },
    ];
    topicsList.forEach((t) => this.topics.set(t.id, t));

    // Courses
    const coursesList: Course[] = [
      { id: 'c-dbms', code: 'CS301', name: 'Database Management Systems' },
      { id: 'c-os', code: 'CS302', name: 'Operating Systems' },
      { id: 'c-net', code: 'CS303', name: 'Computer Networks' },
      { id: 'c-dsa', code: 'CS201', name: 'Data Structures and Algorithms' },
      { id: 'c-dm', code: 'CS202', name: 'Discrete Mathematics' },
      { id: 'c-coa', code: 'CS204', name: 'Computer Organisation' },
      { id: 'c-ai', code: 'CS401', name: 'Artificial Intelligence' },
      { id: 'c-ml', code: 'CS402', name: 'Machine Learning' },
      { id: 'c-se', code: 'CS305', name: 'Software Engineering' },
      { id: 'c-sec', code: 'CS404', name: 'Computer Security' },

      // Core ECE Courses
      { id: 'c-ss', code: 'EC201', name: 'Signals and Systems' },
      { id: 'c-ac', code: 'EC202', name: 'Analog Electronic Circuits' },
      { id: 'c-comm', code: 'EC301', name: 'Digital Communication Systems' },
      { id: 'c-lic', code: 'EC302', name: 'Linear Integrated Circuits' },
      { id: 'c-dsp', code: 'EC303', name: 'Digital Signal Processing' },
      { id: 'c-vlsi', code: 'EC401', name: 'CMOS VLSI Design' },
      { id: 'c-em', code: 'EC204', name: 'Electromagnetic Waves' },
    ];
    coursesList.forEach((c) => this.courses.set(c.id, c));

    // Seed Students (password: demo1234)
    const salt = bcrypt.genSaltSync(8);
    const demoPasswordHash = bcrypt.hashSync('demo1234', salt);

    const students: User[] = [
      {
        id: 'u-akash',
        studentId: '1RV25CS013',
        name: 'Akash Tiwari',
        email: 'akash@campus.demo',
        passwordHash: demoPasswordHash,
        course: 'B.Tech Computer Science & Engineering',
        academicYear: 'Year 3',
        restricted: false,
        notificationPreference: 'NORMAL',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'u-aadya',
        studentId: '1RZ25CS003',
        name: 'Aadya Dhuri',
        email: 'aadya@campus.demo',
        passwordHash: demoPasswordHash,
        course: 'B.Tech Computer Science & Engineering',
        academicYear: 'Year 2',
        restricted: false,
        notificationPreference: 'IMPORTANT',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'u-leila',
        studentId: '1RV25EC045',
        name: 'Leila Khan',
        email: 'leila@campus.demo',
        passwordHash: demoPasswordHash,
        course: 'B.Tech Electronics & Communication Engineering',
        academicYear: 'Year 3',
        restricted: false,
        notificationPreference: 'DIGEST',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'u-dev',
        studentId: '1RV25EC078',
        name: 'Dev Nair',
        email: 'dev@campus.demo',
        passwordHash: demoPasswordHash,
        course: 'B.Tech Electronics & Communication Engineering',
        academicYear: 'Year 4',
        restricted: true,
        notificationPreference: 'QUIET',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'u-priya',
        studentId: '1RV25EC092',
        name: 'Priya Sharma',
        email: 'priya@campus.demo',
        passwordHash: demoPasswordHash,
        course: 'B.Tech Electronics & Communication Engineering',
        academicYear: 'Year 2',
        restricted: false,
        notificationPreference: 'NORMAL',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    students.forEach((s) => this.users.set(s.id, s));

    // 25 Curated Books
    const booksList: Book[] = [
      {
        id: 'b-dsc',
        title: 'Database System Concepts',
        author: 'Silberschatz, Korth, Sudarshan',
        isbn: '9780078022159',
        description: 'Relational model, SQL, normalisation, transactions and storage for undergraduate DBMS courses.',
        category: 'Databases',
        academicLevel: 'Undergraduate year 3',
        resourceType: 'PHYSICAL',
        renewable: true,
        digitalUrl: null,
        topicIds: ['t-norm', 't-sql', 't-ra', 't-tx'],
        courseIds: ['c-dbms'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'b-elmasri',
        title: 'Fundamentals of Database Systems',
        author: 'Elmasri, Navathe',
        isbn: '9780133970777',
        description: 'ER modelling, SQL, normalisation and query processing with worked examples.',
        category: 'Databases',
        academicLevel: 'Undergraduate year 3',
        resourceType: 'BOTH',
        renewable: true,
        digitalUrl: 'https://example.invalid/demo/elmasri',
        topicIds: ['t-norm', 't-sql', 't-ra'],
        courseIds: ['c-dbms'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'b-oscon',
        title: 'Operating System Concepts',
        author: 'Silberschatz, Galvin, Gagne',
        isbn: '9781119800361',
        description: 'Processes, CPU scheduling, memory management, virtual memory, file systems and security.',
        category: 'Systems',
        academicLevel: 'Undergraduate year 2',
        resourceType: 'PHYSICAL',
        renewable: true,
        digitalUrl: null,
        topicIds: ['t-proc', 't-mem', 't-fs'],
        courseIds: ['c-os'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'b-mos',
        title: 'Modern Operating Systems',
        author: 'Andrew S. Tanenbaum, Herbert Bos',
        isbn: '9780133591620',
        description: 'In-depth operating systems principles, process management, memory paging, file systems.',
        category: 'Systems',
        academicLevel: 'Undergraduate year 2',
        resourceType: 'BOTH',
        renewable: true,
        digitalUrl: 'https://example.invalid/demo/mos',
        topicIds: ['t-proc', 't-mem', 't-fs', 't-sec'],
        courseIds: ['c-os'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'b-cn',
        title: 'Computer Networks',
        author: 'Andrew S. Tanenbaum, Nick Feamster',
        isbn: '9780132126953',
        description: 'Five-layer protocol stack, routing algorithms, TCP/IP transport, congestion control.',
        category: 'Networks',
        academicLevel: 'Undergraduate year 3',
        resourceType: 'PHYSICAL',
        renewable: true,
        digitalUrl: null,
        topicIds: ['t-tcp', 't-route', 't-sec'],
        courseIds: ['c-net'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'b-kurose',
        title: 'Computer Networking: A Top-Down Approach',
        author: 'James Kurose, Keith Ross',
        isbn: '9780136681557',
        description: 'Internet application layer, TCP reliable transfer, IP addressing, routing.',
        category: 'Networks',
        academicLevel: 'Undergraduate year 3',
        resourceType: 'PHYSICAL',
        renewable: true,
        digitalUrl: null,
        topicIds: ['t-tcp', 't-route'],
        courseIds: ['c-net'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'b-clrs',
        title: 'Introduction to Algorithms',
        author: 'Cormen, Leiserson, Rivest, Stein',
        isbn: '9780262046305',
        description: 'Asymptotic notation, sorting, dynamic programming, greedy algorithms, graph search.',
        category: 'Algorithms',
        academicLevel: 'Undergraduate year 2',
        resourceType: 'PHYSICAL',
        renewable: true,
        digitalUrl: null,
        topicIds: ['t-sort', 't-dp', 't-graph'],
        courseIds: ['c-dsa'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'b-sedge',
        title: 'Algorithms in Java',
        author: 'Robert Sedgewick, Kevin Wayne',
        isbn: '9780321573513',
        description: 'Practical data structures, sorting and graph processing with Java implementations.',
        category: 'Algorithms',
        academicLevel: 'Undergraduate year 2',
        resourceType: 'BOTH',
        renewable: true,
        digitalUrl: 'https://example.invalid/demo/sedge',
        topicIds: ['t-sort', 't-graph'],
        courseIds: ['c-dsa'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'b-rosen',
        title: 'Discrete Mathematics and Its Applications',
        author: 'Kenneth H. Rosen',
        isbn: '9781259676512',
        description: 'Logic, sets, relations, combinatorics, graph theory and discrete probability.',
        category: 'Mathematics',
        academicLevel: 'Undergraduate year 1',
        resourceType: 'PHYSICAL',
        renewable: true,
        digitalUrl: null,
        topicIds: ['t-logic', 't-comb', 't-graph'],
        courseIds: ['c-dm'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'b-patterson',
        title: 'Computer Organization and Design',
        author: 'David A. Patterson, John L. Hennessy',
        isbn: '9780128122754',
        description: 'RISC-V architecture, arithmetic for computers, pipelining, memory hierarchy and caches.',
        category: 'Architecture',
        academicLevel: 'Undergraduate year 2',
        resourceType: 'PHYSICAL',
        renewable: true,
        digitalUrl: null,
        topicIds: ['t-arch', 't-pipe', 't-mem'],
        courseIds: ['c-coa'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'b-aima',
        title: 'Artificial Intelligence: A Modern Approach',
        author: 'Stuart Russell, Peter Norvig',
        isbn: '9780134610993',
        description: 'Search algorithms, knowledge representation, probabilistic reasoning, machine learning.',
        category: 'AI',
        academicLevel: 'Undergraduate year 4',
        resourceType: 'PHYSICAL',
        renewable: true,
        digitalUrl: null,
        topicIds: ['t-search', 't-ml', 't-logic'],
        courseIds: ['c-ai'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'b-bishop',
        title: 'Pattern Recognition and Machine Learning',
        author: 'Christopher M. Bishop',
        isbn: '9780387310732',
        description: 'Probabilistic machine learning, linear models, neural networks and kernel methods.',
        category: 'AI',
        academicLevel: 'Postgraduate / Senior',
        resourceType: 'BOTH',
        renewable: true,
        digitalUrl: 'https://example.invalid/demo/prml',
        topicIds: ['t-ml', 't-nn', 't-prob', 't-lin'],
        courseIds: ['c-ml'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'b-clean',
        title: 'Clean Code',
        author: 'Robert C. Martin',
        isbn: '9780132350884',
        description: 'Meaningful naming, small functions, unit testing and refactoring for software engineers.',
        category: 'Software Engineering',
        academicLevel: 'Undergraduate year 3',
        resourceType: 'PHYSICAL',
        renewable: true,
        digitalUrl: null,
        topicIds: ['t-se', 't-oo'],
        courseIds: ['c-se'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'b-gof',
        title: 'Design Patterns',
        author: 'Gamma, Helm, Johnson, Vlissides',
        isbn: '9780201633610',
        description: 'Creational, structural and behavioral object-oriented software patterns.',
        category: 'Software Engineering',
        academicLevel: 'Undergraduate year 3',
        resourceType: 'PHYSICAL',
        renewable: true,
        digitalUrl: null,
        topicIds: ['t-oo', 't-se'],
        courseIds: ['c-se'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'b-dragon',
        title: 'Compilers: Principles, Techniques, and Tools',
        author: 'Aho, Lam, Sethi, Ullman',
        isbn: '9780321486813',
        description: 'Lexical analysis, syntax-directed translation, parsing, intermediate code generation.',
        category: 'Systems',
        academicLevel: 'Undergraduate year 3',
        resourceType: 'PHYSICAL',
        renewable: false, // Explicitly marked not renewable
        digitalUrl: null,
        topicIds: ['t-compile'],
        courseIds: ['c-os'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'b-somm',
        title: 'Software Engineering',
        author: 'Ian Sommerville',
        isbn: '9780133943030',
        description: 'System modeling, agile development, software testing and evolution.',
        category: 'Software Engineering',
        academicLevel: 'Undergraduate year 2',
        resourceType: 'PHYSICAL',
        renewable: true,
        digitalUrl: null,
        topicIds: ['t-se'],
        courseIds: ['c-se'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'b-stallings',
        title: 'Cryptography and Network Security',
        author: 'William Stallings',
        isbn: '9780134444284',
        description: 'Symmetric ciphers, public-key encryption, hash algorithms and network protocols.',
        category: 'Security',
        academicLevel: 'Undergraduate year 3',
        resourceType: 'PHYSICAL',
        renewable: true,
        digitalUrl: null,
        topicIds: ['t-sec'],
        courseIds: ['c-sec', 'c-net'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'b-han',
        title: 'Data Mining: Concepts and Techniques',
        author: 'Jiawei Han, Micheline Kamber',
        isbn: '9780123814791',
        description: 'Association rules, clustering, data warehousing and classification.',
        category: 'Databases',
        academicLevel: 'Undergraduate year 4',
        resourceType: 'PHYSICAL',
        renewable: true,
        digitalUrl: null,
        topicIds: ['t-sql', 't-ml'],
        courseIds: ['c-dbms'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'b-strang',
        title: 'Linear Algebra and Its Applications',
        author: 'Gilbert Strang',
        isbn: '9780030105678',
        description: 'Matrix theory, eigenvalues, vector spaces and applications in computing.',
        category: 'Mathematics',
        academicLevel: 'Undergraduate year 1',
        resourceType: 'PHYSICAL',
        renewable: true,
        digitalUrl: null,
        topicIds: ['t-lin'],
        courseIds: ['c-dm'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'b-devore',
        title: 'Probability and Statistics',
        author: 'Jay L. Devore',
        isbn: '9781305251809',
        description: 'Introductory probability and hypothesis testing for computing students.',
        category: 'Mathematics',
        academicLevel: 'Undergraduate year 2',
        resourceType: 'PHYSICAL',
        renewable: true,
        digitalUrl: null,
        topicIds: ['t-prob'],
        courseIds: ['c-ml'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'b-mano',
        title: 'Digital Design',
        author: 'M. Morris Mano',
        isbn: '9780132774208',
        description: 'Combinational logic, sequential circuits and register transfer systems.',
        category: 'Architecture',
        academicLevel: 'Undergraduate year 2',
        resourceType: 'PHYSICAL',
        renewable: true,
        digitalUrl: null,
        topicIds: ['t-arch'],
        courseIds: ['c-coa'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'b-kr',
        title: 'The C Programming Language',
        author: 'Kernighan, Ritchie',
        isbn: '9780131103627',
        description: 'ANSI C language reference for systems programming.',
        category: 'Programming',
        academicLevel: 'Undergraduate year 1',
        resourceType: 'PHYSICAL',
        renewable: true,
        digitalUrl: null,
        topicIds: ['t-proc'],
        courseIds: ['c-os'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'b-pda',
        title: 'Python for Data Analysis',
        author: 'Wes McKinney',
        isbn: '9781491957660',
        description: 'Data wrangling with Pandas and NumPy. Digital learning resource.',
        category: 'Data',
        academicLevel: 'Undergraduate year 3',
        resourceType: 'DIGITAL',
        renewable: false,
        digitalUrl: 'https://example.invalid/demo/pda',
        topicIds: ['t-sql', 't-ml'],
        courseIds: ['c-ml'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'b-ramakrishnan',
        title: 'Database Management Systems',
        author: 'Ramakrishnan, Gehrke',
        isbn: '9780072465631',
        description: 'Storage, indexing, SQL queries, relational algebra and normalisation.',
        category: 'Databases',
        academicLevel: 'Undergraduate year 3',
        resourceType: 'PHYSICAL',
        renewable: true,
        digitalUrl: null,
        topicIds: ['t-norm', 't-sql', 't-tx', 't-ra'],
        courseIds: ['c-dbms'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'b-tan-os',
        title: 'Operating Systems: Design and Implementation',
        author: 'Andrew S. Tanenbaum, Albert S. Woodhull',
        isbn: '9780131429383',
        description: 'MINIX operating system architecture, process scheduling and memory management.',
        category: 'Systems',
        academicLevel: 'Undergraduate year 3',
        resourceType: 'PHYSICAL',
        renewable: true,
        digitalUrl: null,
        topicIds: ['t-proc', 't-mem', 't-fs'],
        courseIds: ['c-os'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      // --- Core ECE Books ---
      {
        id: 'b-opp-ss',
        title: 'Signals and Systems',
        author: 'Alan V. Oppenheim, Alan S. Willsky',
        isbn: '9780138147570',
        description: 'Continuous-time and discrete-time signals, LTI systems, Fourier analysis, Laplace and Z-transforms for ECE.',
        category: 'Electronics',
        academicLevel: 'Undergraduate year 2',
        resourceType: 'PHYSICAL',
        renewable: true,
        digitalUrl: null,
        topicIds: ['t-ss', 't-ft', 't-lin'],
        courseIds: ['c-ss'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'b-proakis',
        title: 'Digital Signal Processing',
        author: 'John G. Proakis, Dimitris G. Manolakis',
        isbn: '9780131873742',
        description: 'Discrete-time signals, z-transform, DFT/FFT algorithms, FIR/IIR digital filter design for communications.',
        category: 'Electronics',
        academicLevel: 'Undergraduate year 3',
        resourceType: 'BOTH',
        renewable: true,
        digitalUrl: 'https://example.invalid/demo/dsp-proakis',
        topicIds: ['t-dsp', 't-ft', 't-ss'],
        courseIds: ['c-dsp', 'c-ss'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'b-sedra',
        title: 'Microelectronic Circuits',
        author: 'Adel S. Sedra, Kenneth C. Smith',
        isbn: '9780190853464',
        description: 'BJT, MOSFET amplifiers, frequency response, feedback, operational amplifiers and analog circuits.',
        category: 'Electronics',
        academicLevel: 'Undergraduate year 2',
        resourceType: 'PHYSICAL',
        renewable: true,
        digitalUrl: null,
        topicIds: ['t-analog', 't-bjt'],
        courseIds: ['c-ac', 'c-lic'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'b-razavi',
        title: 'Fundamentals of Microelectronics',
        author: 'Behzad Razavi',
        isbn: '9781118156322',
        description: 'Intuitive analog integrated circuit analysis, diode circuits, bipolar and MOS transistor stages.',
        category: 'Electronics',
        academicLevel: 'Undergraduate year 2',
        resourceType: 'PHYSICAL',
        renewable: true,
        digitalUrl: null,
        topicIds: ['t-analog', 't-bjt'],
        courseIds: ['c-ac'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'b-lathi',
        title: 'Modern Digital and Analog Communication',
        author: 'B.P. Lathi, Zhi Ding',
        isbn: '9780199370054',
        description: 'Signals, spectra, AM/FM modulation, pulse code modulation, digital transmission, error control.',
        category: 'Communications',
        academicLevel: 'Undergraduate year 3',
        resourceType: 'BOTH',
        renewable: true,
        digitalUrl: 'https://example.invalid/demo/comm-lathi',
        topicIds: ['t-digcomm', 't-ss', 't-prob'],
        courseIds: ['c-comm', 'c-ss'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'b-haykin',
        title: 'Communication Systems',
        author: 'Simon Haykin, Michael Moher',
        isbn: '9780471697909',
        description: 'Analog modulation, PCM, digital carrier modulation (QAM, PSK), noise analysis, information theory.',
        category: 'Communications',
        academicLevel: 'Undergraduate year 3',
        resourceType: 'PHYSICAL',
        renewable: true,
        digitalUrl: null,
        topicIds: ['t-digcomm', 't-prob'],
        courseIds: ['c-comm'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'b-weste',
        title: 'CMOS VLSI Design',
        author: 'Neil H.E. Weste, David Money Harris',
        isbn: '9780321547743',
        description: 'CMOS logic gates, delay estimation, power dissipation, interconnects, circuit simulation.',
        category: 'Electronics',
        academicLevel: 'Undergraduate year 4',
        resourceType: 'PHYSICAL',
        renewable: true,
        topicIds: ['t-vlsi', 't-arch'],
        courseIds: ['c-vlsi', 'c-coa'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'b-sadiku',
        title: 'Principles of Electromagnetics',
        author: 'Matthew N.O. Sadiku',
        isbn: '9780199461998',
        description: 'Electrostatics, magnetostatics, Maxwell equations, plane wave propagation, transmission lines.',
        category: 'Electronics',
        academicLevel: 'Undergraduate year 2',
        resourceType: 'PHYSICAL',
        renewable: true,
        digitalUrl: null,
        topicIds: ['t-em', 't-lin'],
        courseIds: ['c-em'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    booksList.forEach((b) => this.books.set(b.id, b));

    // Physical Copies
    const copiesList: BookCopy[] = [
      { id: 'c-dsc-1', bookId: 'b-dsc', code: 'DB-101', status: 'ON_LOAN', createdAt: new Date(), updatedAt: new Date() },
      { id: 'c-dsc-2', bookId: 'b-dsc', code: 'DB-102', status: 'AVAILABLE', createdAt: new Date(), updatedAt: new Date() },
      { id: 'c-el-1', bookId: 'b-elmasri', code: 'DB-201', status: 'AVAILABLE', createdAt: new Date(), updatedAt: new Date() },
      { id: 'c-el-2', bookId: 'b-elmasri', code: 'DB-202', status: 'AVAILABLE', createdAt: new Date(), updatedAt: new Date() },
      { id: 'c-os-1', bookId: 'b-oscon', code: 'OS-101', status: 'ON_LOAN', createdAt: new Date(), updatedAt: new Date() },
      { id: 'c-os-2', bookId: 'b-oscon', code: 'OS-102', status: 'RESERVED', createdAt: new Date(), updatedAt: new Date() },
      { id: 'c-mos-1', bookId: 'b-mos', code: 'OS-201', status: 'ON_LOAN', createdAt: new Date(), updatedAt: new Date() },
      { id: 'c-mos-2', bookId: 'b-mos', code: 'OS-202', status: 'AVAILABLE', createdAt: new Date(), updatedAt: new Date() },
      { id: 'c-cn-1', bookId: 'b-cn', code: 'NET-101', status: 'ON_LOAN', createdAt: new Date(), updatedAt: new Date() },
      { id: 'c-cn-2', bookId: 'b-cn', code: 'NET-102', status: 'AVAILABLE', createdAt: new Date(), updatedAt: new Date() },
      { id: 'c-kur-1', bookId: 'b-kurose', code: 'NET-201', status: 'AVAILABLE', createdAt: new Date(), updatedAt: new Date() },
      { id: 'c-clrs-1', bookId: 'b-clrs', code: 'ALG-101', status: 'AVAILABLE', createdAt: new Date(), updatedAt: new Date() },
      { id: 'c-sed-1', bookId: 'b-sedge', code: 'ALG-201', status: 'AVAILABLE', createdAt: new Date(), updatedAt: new Date() },
      { id: 'c-ros-1', bookId: 'b-rosen', code: 'DM-101', status: 'AVAILABLE', createdAt: new Date(), updatedAt: new Date() },
      { id: 'c-pat-1', bookId: 'b-patterson', code: 'COA-101', status: 'AVAILABLE', createdAt: new Date(), updatedAt: new Date() },
      { id: 'c-drag-1', bookId: 'b-dragon', code: 'CMP-101', status: 'AVAILABLE', createdAt: new Date(), updatedAt: new Date() },
      { id: 'c-ram-1', bookId: 'b-ramakrishnan', code: 'DB-401', status: 'AVAILABLE', createdAt: new Date(), updatedAt: new Date() },
      { id: 'c-str-1', bookId: 'b-strang', code: 'MA-101', status: 'AVAILABLE', createdAt: new Date(), updatedAt: new Date() },
      { id: 'c-dev-1', bookId: 'b-devore', code: 'MA-201', status: 'AVAILABLE', createdAt: new Date(), updatedAt: new Date() },

      // ECE Copies
      { id: 'c-opp-1', bookId: 'b-opp-ss', code: 'EC-101', status: 'AVAILABLE', createdAt: new Date(), updatedAt: new Date() },
      { id: 'c-opp-2', bookId: 'b-opp-ss', code: 'EC-102', status: 'AVAILABLE', createdAt: new Date(), updatedAt: new Date() },
      { id: 'c-pro-1', bookId: 'b-proakis', code: 'EC-201', status: 'ON_LOAN', createdAt: new Date(), updatedAt: new Date() },
      { id: 'c-pro-2', bookId: 'b-proakis', code: 'EC-202', status: 'AVAILABLE', createdAt: new Date(), updatedAt: new Date() },
      { id: 'c-sedra-1', bookId: 'b-sedra', code: 'EC-301', status: 'ON_LOAN', createdAt: new Date(), updatedAt: new Date() },
      { id: 'c-sedra-2', bookId: 'b-sedra', code: 'EC-302', status: 'AVAILABLE', createdAt: new Date(), updatedAt: new Date() },
      { id: 'c-raz-1', bookId: 'b-razavi', code: 'EC-401', status: 'AVAILABLE', createdAt: new Date(), updatedAt: new Date() },
      { id: 'c-lat-1', bookId: 'b-lathi', code: 'EC-501', status: 'AVAILABLE', createdAt: new Date(), updatedAt: new Date() },
      { id: 'c-hay-1', bookId: 'b-haykin', code: 'EC-601', status: 'AVAILABLE', createdAt: new Date(), updatedAt: new Date() },
      { id: 'c-wes-1', bookId: 'b-weste', code: 'EC-701', status: 'AVAILABLE', createdAt: new Date(), updatedAt: new Date() },
      { id: 'c-sad-1', bookId: 'b-sadiku', code: 'EC-801', status: 'ON_LOAN', createdAt: new Date(), updatedAt: new Date() },
      { id: 'c-sad-2', bookId: 'b-sadiku', code: 'EC-802', status: 'AVAILABLE', createdAt: new Date(), updatedAt: new Date() },
    ];
    copiesList.forEach((c) => this.copies.set(c.id, c));

    // Simulated Loans (Relative to reference anchor 2026-11-21)
    const now = new Date('2026-11-21T12:00:00Z');
    const day = 24 * 60 * 60 * 1000;

    const loansList: Loan[] = [
      // Akash (1RV25CS013 - CSE) - Mixed loans
      {
        id: 'l-akash-dsc',
        copyId: 'c-dsc-1',
        userId: 'u-akash',
        bookId: 'b-dsc',
        issuedAt: new Date(now.getTime() - 12 * day),
        dueAt: new Date(now.getTime() + 2 * day), // Due in 2 days (Renewable)
        status: 'ACTIVE',
        renewalCount: 0,
        markedForReturn: false,
        needDecision: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'l-akash-os',
        copyId: 'c-os-1',
        userId: 'u-akash',
        bookId: 'b-oscon',
        issuedAt: new Date(now.getTime() - 13 * day),
        dueAt: new Date(now.getTime() + 1 * day), // Due in 1 day (Blocked by reservation)
        status: 'ACTIVE',
        renewalCount: 0,
        markedForReturn: false,
        needDecision: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'l-akash-cn',
        copyId: 'c-cn-1',
        userId: 'u-akash',
        bookId: 'b-cn',
        issuedAt: new Date(now.getTime() - 5 * day),
        dueAt: new Date(now.getTime() + 18 * day), // On track
        status: 'ACTIVE',
        renewalCount: 1,
        markedForReturn: false,
        needDecision: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },

      // Aadya (1RZ25CS003 - CSE) - Approaching due date
      {
        id: 'l-aadya-os',
        copyId: 'c-mos-1',
        userId: 'u-aadya',
        bookId: 'b-mos',
        issuedAt: new Date(now.getTime() - 11 * day),
        dueAt: new Date(now.getTime() + 3 * day),
        status: 'ACTIVE',
        renewalCount: 0,
        markedForReturn: false,
        needDecision: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },

      // Leila (1RV25EC045 - ECE) - Max renewals reached on DSP book
      {
        id: 'l-leila-dsp',
        copyId: 'c-pro-1',
        userId: 'u-leila',
        bookId: 'b-proakis',
        issuedAt: new Date(now.getTime() - 26 * day),
        dueAt: new Date(now.getTime() + 2 * day),
        status: 'ACTIVE',
        renewalCount: 2, // Max renewals reached (limit is 2)
        markedForReturn: false,
        needDecision: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },

      // Dev (1RV25EC078 - ECE) - Account restricted on Microelectronics
      {
        id: 'l-dev-sedra',
        copyId: 'c-sedra-1',
        userId: 'u-dev',
        bookId: 'b-sedra',
        issuedAt: new Date(now.getTime() - 10 * day),
        dueAt: new Date(now.getTime() + 4 * day),
        status: 'ACTIVE',
        renewalCount: 0,
        markedForReturn: false,
        needDecision: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },

      // Priya (1RV25EC092 - ECE) - Overdue book on Electromagnetics
      {
        id: 'l-priya-sadiku',
        copyId: 'c-sad-1',
        userId: 'u-priya',
        bookId: 'b-sadiku',
        issuedAt: new Date(now.getTime() - 18 * day),
        dueAt: new Date(now.getTime() - 4 * day), // 4 days overdue
        status: 'OVERDUE',
        renewalCount: 0,
        markedForReturn: false,
        needDecision: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    loansList.forEach((l) => this.loans.set(l.id, l));

    // Reservations (Aadya reserved OS Concepts, blocking Akash's renewal)
    const reservationsList: Reservation[] = [
      {
        id: 'r-aadya-os',
        bookId: 'b-oscon',
        userId: 'u-aadya',
        status: 'ACTIVE',
        createdAt: new Date(now.getTime() - 2 * day),
        updatedAt: new Date(),
      },
    ];
    reservationsList.forEach((r) => this.reservations.set(r.id, r));

    // Academic Needs (Akash needs Database Normalisation; Leila needs DSP)
    const needsList: AcademicNeed[] = [
      {
        id: 'need-akash-norm',
        userId: 'u-akash',
        course: 'Database Management Systems',
        topic: 'Database Normalisation',
        assessmentType: 'INTERNAL',
        assessmentDate: new Date('2026-11-28'),
        neededUntil: new Date('2026-11-28'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'need-leila-dsp',
        userId: 'u-leila',
        course: 'Digital Signal Processing',
        topic: 'Digital Signal Processing',
        assessmentType: 'PROJECT',
        assessmentDate: new Date('2026-12-05'),
        neededUntil: new Date('2026-12-05'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    needsList.forEach((n) => this.academicNeeds.set(n.id, n));

    // Fines (Priya has simulated overdue fine: 4 days * 5 = 20)
    this.fines.push({
      id: 'fine-priya-1',
      userId: 'u-priya',
      loanId: 'l-priya-sadiku',
      amount: 20.0,
      reason: 'Overdue loan: Principles of Electromagnetics (4 days late at ₹5/day)',
      createdAt: new Date(now.getTime() - 1 * day),
    });

    // Seed Notifications
    this.notifications.push(
      {
        id: 'notif-1',
        userId: 'u-akash',
        title: 'Upcoming Due Date',
        message: 'Operating System Concepts is due tomorrow. Another student has reserved it.',
        kind: 'DUE_SOON',
        read: false,
        createdAt: new Date(now.getTime() - 4 * 60 * 60 * 1000),
      },
      {
        id: 'notif-2',
        userId: 'u-akash',
        title: 'Renewal Available',
        message: 'Database System Concepts is eligible for a 14-day renewal.',
        kind: 'RENEWAL_OPPORTUNITY',
        read: true,
        createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    );
  }
}

export class MemoryUserRepository implements IUserRepository {
  constructor(private store: MemoryStore) {}

  async findById(id: string): Promise<User | null> {
    return this.store.users.get(id) || null;
  }

  async findByStudentId(studentId: string): Promise<User | null> {
    const key = studentId.trim().toLowerCase();
    for (const u of this.store.users.values()) {
      if (u.studentId.toLowerCase() === key) return u;
    }
    return null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const key = email.trim().toLowerCase();
    for (const u of this.store.users.values()) {
      if (u.email.toLowerCase() === key) return u;
    }
    return null;
  }

  async create(data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const user: User = {
      ...data,
      id: `u-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.store.users.set(user.id, user);
    return user;
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    const user = this.store.users.get(id);
    if (!user) throw new Error('User not found');
    const updated = { ...user, ...data, updatedAt: new Date() };
    this.store.users.set(id, updated);
    return updated;
  }
}

export class MemoryBookRepository implements IBookRepository {
  constructor(private store: MemoryStore) {}

  async findAll(): Promise<Book[]> {
    return Array.from(this.store.books.values());
  }

  async findById(id: string): Promise<Book | null> {
    return this.store.books.get(id) || null;
  }

  async search(query: { q?: string; category?: string; courseId?: string; type?: string }): Promise<Book[]> {
    let list = Array.from(this.store.books.values());
    if (query.q) {
      const q = query.q.toLowerCase().trim();
      list = list.filter((b) => {
        const topicNames = b.topicIds.map((id) => this.store.topics.get(id)?.name.toLowerCase() || '').join(' ');
        return (
          b.title.toLowerCase().includes(q) ||
          b.author.toLowerCase().includes(q) ||
          b.isbn.includes(q) ||
          b.category.toLowerCase().includes(q) ||
          topicNames.includes(q)
        );
      });
    }
    if (query.category) {
      list = list.filter((b) => b.category.toLowerCase() === query.category!.toLowerCase());
    }
    if (query.courseId) {
      list = list.filter((b) => b.courseIds.includes(query.courseId!));
    }
    if (query.type === 'PHYSICAL') {
      list = list.filter((b) => b.resourceType !== 'DIGITAL');
    } else if (query.type === 'DIGITAL') {
      list = list.filter((b) => b.resourceType !== 'PHYSICAL');
    }
    return list;
  }

  async findTopics(): Promise<Topic[]> {
    return Array.from(this.store.topics.values());
  }

  async findCourses(): Promise<Course[]> {
    return Array.from(this.store.courses.values());
  }

  async findCopiesByBookId(bookId: string): Promise<BookCopy[]> {
    return Array.from(this.store.copies.values()).filter((c) => c.bookId === bookId);
  }

  async countAvailablePhysicalCopies(bookId: string): Promise<number> {
    return Array.from(this.store.copies.values()).filter(
      (c) => c.bookId === bookId && c.status === 'AVAILABLE',
    ).length;
  }

  async countAllAvailablePhysical(): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    for (const b of this.store.books.values()) {
      counts.set(b.id, 0);
    }
    for (const copy of this.store.copies.values()) {
      if (copy.status === 'AVAILABLE') {
        counts.set(copy.bookId, (counts.get(copy.bookId) || 0) + 1);
      }
    }
    return counts;
  }
}

export class MemoryLoanRepository implements ILoanRepository {
  constructor(private store: MemoryStore) {}

  async findById(id: string): Promise<Loan | null> {
    return this.store.loans.get(id) || null;
  }

  async findByUserId(userId: string): Promise<Loan[]> {
    return Array.from(this.store.loans.values()).filter((l) => l.userId === userId);
  }

  async findActiveByCopyId(copyId: string): Promise<Loan | null> {
    for (const l of this.store.loans.values()) {
      if (l.copyId === copyId && (l.status === 'ACTIVE' || l.status === 'OVERDUE')) {
        return l;
      }
    }
    return null;
  }

  async create(data: Omit<Loan, 'id' | 'createdAt' | 'updatedAt'>): Promise<Loan> {
    const loan: Loan = {
      ...data,
      id: `l-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.store.loans.set(loan.id, loan);
    return loan;
  }

  async update(id: string, data: Partial<Loan>): Promise<Loan> {
    const loan = this.store.loans.get(id);
    if (!loan) throw new Error('Loan not found');
    const updated = { ...loan, ...data, updatedAt: new Date() };
    this.store.loans.set(id, updated);
    return updated;
  }
}

export class MemoryReservationRepository implements IReservationRepository {
  constructor(private store: MemoryStore) {}

  async findActiveByBookId(bookId: string): Promise<Reservation[]> {
    return Array.from(this.store.reservations.values()).filter(
      (r) => r.bookId === bookId && r.status === 'ACTIVE',
    );
  }

  async findByUserId(userId: string): Promise<Reservation[]> {
    return Array.from(this.store.reservations.values()).filter((r) => r.userId === userId);
  }

  async create(data: Omit<Reservation, 'id' | 'createdAt' | 'updatedAt'>): Promise<Reservation> {
    const res: Reservation = {
      ...data,
      id: `r-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.store.reservations.set(res.id, res);
    return res;
  }
}

export class MemoryRenewalAttemptRepository implements IRenewalAttemptRepository {
  constructor(private store: MemoryStore) {}

  async findByLoanId(loanId: string): Promise<RenewalAttempt[]> {
    return this.store.renewalAttempts.filter((a) => a.loanId === loanId);
  }

  async create(data: Omit<RenewalAttempt, 'id' | 'createdAt'>): Promise<RenewalAttempt> {
    const attempt: RenewalAttempt = {
      ...data,
      id: `ra-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date(),
    };
    this.store.renewalAttempts.unshift(attempt);
    return attempt;
  }
}

export class MemoryAcademicNeedRepository implements IAcademicNeedRepository {
  constructor(private store: MemoryStore) {}

  async findByUserId(userId: string): Promise<AcademicNeed[]> {
    return Array.from(this.store.academicNeeds.values()).filter((n) => n.userId === userId);
  }

  async create(data: Omit<AcademicNeed, 'id' | 'createdAt' | 'updatedAt'>): Promise<AcademicNeed> {
    const need: AcademicNeed = {
      ...data,
      id: `need-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.store.academicNeeds.set(need.id, need);
    return need;
  }

  async update(id: string, userId: string, data: Partial<AcademicNeed>): Promise<AcademicNeed | null> {
    const need = this.store.academicNeeds.get(id);
    if (!need || need.userId !== userId) return null;
    const updated = { ...need, ...data, updatedAt: new Date() };
    this.store.academicNeeds.set(id, updated);
    return updated;
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const need = this.store.academicNeeds.get(id);
    if (!need || need.userId !== userId) return false;
    return this.store.academicNeeds.delete(id);
  }
}

export class MemoryNotificationRepository implements INotificationRepository {
  constructor(private store: MemoryStore) {}

  async findByUserId(userId: string): Promise<Notification[]> {
    return this.store.notifications.filter((n) => n.userId === userId);
  }

  async create(data: Omit<Notification, 'id' | 'createdAt'>): Promise<Notification> {
    const notif: Notification = {
      ...data,
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date(),
    };
    this.store.notifications.unshift(notif);
    return notif;
  }

  async markRead(id: string, userId: string): Promise<Notification | null> {
    const notif = this.store.notifications.find((n) => n.id === id && n.userId === userId);
    if (notif) notif.read = true;
    return notif || null;
  }

  async findDuplicateRecent(userId: string, kind: string, title: string, withinMinutes: number): Promise<boolean> {
    const threshold = new Date(Date.now() - withinMinutes * 60 * 1000);
    return this.store.notifications.some(
      (n) => n.userId === userId && n.kind === kind && n.title === title && n.createdAt >= threshold,
    );
  }
}

export class MemoryFineRepository implements IFineRepository {
  constructor(private store: MemoryStore) {}

  async findByUserId(userId: string): Promise<FineLedger[]> {
    return this.store.fines.filter((f) => f.userId === userId);
  }

  async create(data: Omit<FineLedger, 'id' | 'createdAt'>): Promise<FineLedger> {
    const fine: FineLedger = {
      ...data,
      id: `fine-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date(),
    };
    this.store.fines.unshift(fine);
    return fine;
  }
}

export class MemoryPolicyRepository implements IPolicyRepository {
  constructor(private store: MemoryStore) {}

  async getDefaultPolicy(): Promise<LibraryPolicy> {
    return this.store.policy;
  }
}

