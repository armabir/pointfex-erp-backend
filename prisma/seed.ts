import 'dotenv/config'
import { PrismaClient, Prisma } from '@prisma/client'
import { seedRbac } from './seed-rbac'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting Pointfex ERP Bangladesh-Oriented Seed...')

  // --------------------------------------------------------------------------
  // 1. POSITIONS (Independent Organizational Seats)
  // --------------------------------------------------------------------------
  console.log('  -> Seeding Positions...')

  const positions = [
    // Executive Positions
    {
      id: 'pos_ceo',
      code: 'CEO',
      title: 'Chief Executive Officer',
      department: 'Executive',
      roleCategory: 'ceo',
    },
    {
      id: 'pos_cto',
      code: 'CTO',
      title: 'Chief Technology Officer',
      department: 'Executive',
      roleCategory: 'cto',
    },
    {
      id: 'pos_cfo',
      code: 'CFO',
      title: 'Chief Financial Officer',
      department: 'Executive',
      roleCategory: 'cfo',
    },
    {
      id: 'pos_chro',
      code: 'CHRO',
      title: 'Chief Human Resources Officer',
      department: 'Executive',
      roleCategory: 'chro',
    },

    // Project Manager Positions (PM-01 to PM-06)
    {
      id: 'pos_pm_01',
      code: 'PM-01',
      title: 'Project Manager (Squad Alpha)',
      department: 'Project Management',
      roleCategory: 'pm',
    },
    {
      id: 'pos_pm_02',
      code: 'PM-02',
      title: 'Project Manager (Squad Bravo)',
      department: 'Project Management',
      roleCategory: 'pm',
    },
    {
      id: 'pos_pm_03',
      code: 'PM-03',
      title: 'Project Manager (Squad Charlie)',
      department: 'Project Management',
      roleCategory: 'pm',
    },
    {
      id: 'pos_pm_04',
      code: 'PM-04',
      title: 'Project Manager (Squad Delta)',
      department: 'Project Management',
      roleCategory: 'pm',
    },
    {
      id: 'pos_pm_05',
      code: 'PM-05',
      title: 'Project Manager (Squad Echo)',
      department: 'Project Management',
      roleCategory: 'pm',
    },
    {
      id: 'pos_pm_06',
      code: 'PM-06',
      title: 'Project Manager (Squad Foxtrot)',
      department: 'Project Management',
      roleCategory: 'pm',
    },

    // Developer Positions (DEV-01 to DEV-24)
    ...Array.from({ length: 24 }).map((_, i) => {
      const num = String(i + 1).padStart(2, '0')
      return {
        id: `pos_dev_${num}`,
        code: `DEV-${num}`,
        title: i % 4 === 0 ? 'Lead Software Engineer' : 'Full-Stack Software Engineer',
        department: 'Engineering',
        roleCategory: 'developer',
      }
    }),
  ]

  for (const pos of positions) {
    await prisma.position.upsert({
      where: { id: pos.id },
      update: pos,
      create: pos,
    })
  }

  // --------------------------------------------------------------------------
  // 2. EMPLOYEES (Fictional Bangladeshi Personnel)
  // --------------------------------------------------------------------------
  console.log('  -> Seeding Employees (Bangladeshi Staffing Model)...')

  const employees = [
    // --- C-SUITE LEADERSHIP (4 Executives) ---
    {
      id: 'emp_ceo_01',
      name: 'Noor',
      email: 'noor.ceo@pointfex.internal',
      title: 'Chief Executive Officer',
      initials: 'NR',
      avatarUrl: '',
      status: 'online',
      skills: [
        'Corporate Governance',
        'Capital Allocation',
        'Strategic Partnerships',
        'Academic Leadership',
      ],
      timezone: 'UTC+6 (BST)',
      phone: '+880 1711-000001',
      location: 'Gulshan-2, Dhaka',
      bio: 'Chief Executive Officer overseeing corporate governance, strategic roadmap, and executive authority.',
    },
    {
      id: 'emp_cto_01',
      name: 'Abir',
      email: 'abir.cto@pointfex.internal',
      title: 'Chief Technology Officer',
      initials: 'AB',
      avatarUrl: '',
      status: 'online',
      skills: [
        'Distributed Architecture',
        'Zero-Trust Security',
        'Kubernetes',
        'High-Throughput Systems',
        'Quality Gates',
      ],
      timezone: 'UTC+6 (BST)',
      github: 'github.com/abir-cto-pointfex',
      phone: '+880 1819-000002',
      location: 'Dhanmondi, Dhaka',
      bio: 'Chief Technology Officer leading software architecture, code quality gates, technical consultancy, and cross-team technology stacks.',
    },
    {
      id: 'emp_cfo_01',
      name: 'Rahid',
      email: 'rahid.cfo@pointfex.internal',
      title: 'Chief Financial Officer',
      initials: 'RH',
      avatarUrl: '',
      status: 'online',
      skills: [
        'Treasury Management',
        'Budget Allocation',
        'Financial Modeling',
        'SOC-1 Audit',
        'Escrow Management',
      ],
      timezone: 'UTC+6 (BST)',
      phone: '+880 1912-000003',
      location: 'Uttara Sector 4, Dhaka',
      bio: 'Chief Financial Officer governing corporate liquid reserves, project budget lines, developer payouts, and commercial revenue sharing.',
    },
    {
      id: 'emp_chro_01',
      name: 'Naim',
      email: 'naim.chro@pointfex.internal',
      title: 'Chief Human Resources Officer',
      initials: 'NM',
      avatarUrl: '',
      status: 'online',
      skills: [
        'Performance Management',
        'Confidential Dispute Mediation',
        'Organizational Culture',
        'Squad Morale Scorecards',
      ],
      timezone: 'UTC+6 (BST)',
      phone: '+880 1613-000004',
      location: 'Banani, Dhaka',
      bio: 'Chief Human Resources Officer governing staff onboarding, evaluations, talent growth, and confidential grievance adjudication.',
    },

    // --- 6 PROJECT MANAGERS (PMs) ---
    {
      id: 'emp_pm_01',
      name: 'Jihad',
      email: 'jihad.pm@pointfex.internal',
      title: 'Senior Agile Project Manager',
      initials: 'JH',
      avatarUrl: '',
      status: 'online',
      skills: ['Sprint Planning', 'Kanban Optimization', 'Risk Mitigation', 'Scrum Leadership'],
      phone: '+880 1712-100001',
      location: 'Mirpur DOHS, Dhaka',
      bio: 'Squad Alpha PM ensuring high velocity delivery for Unseen Bangladesh and Ghush.com platforms.',
    },
    {
      id: 'emp_pm_02',
      name: 'Nusrat Jahan',
      email: 'nusrat.jahan@pointfex.internal',
      title: 'Technical Project Manager (Cloud)',
      initials: 'NJ',
      avatarUrl: '',
      status: 'online',
      skills: ['Microservices Delivery', 'CI/CD Pipelines', 'Cloud Governance', 'Agile Roadmaps'],
      phone: '+880 1812-100002',
      location: 'Panchlaish, Chattogram',
      bio: 'Squad Bravo PM driving EduConnect BD and ShebaFinder infrastructure deliverables.',
    },
    {
      id: 'emp_pm_03',
      name: 'Mahmudul Hasan',
      email: 'mahmudul.hasan@pointfex.internal',
      title: 'Agile Delivery Lead (Mobile)',
      initials: 'MH',
      avatarUrl: '',
      status: 'online',
      skills: ['Mobile Sprints', 'React Native Release Mgmt', 'User Feedback Loops', 'Jira/Linear'],
      phone: '+880 1913-100003',
      location: 'Zindabazar, Sylhet',
      bio: 'Squad Charlie PM coordinating KrishiBondhu and Dhaka Traffic Watch cross-platform releases.',
    },
    {
      id: 'emp_pm_04',
      name: 'Sadia Islam',
      email: 'sadia.islam@pointfex.internal',
      title: 'Security Program Manager',
      initials: 'SI',
      avatarUrl: '',
      status: 'away',
      skills: [
        'Zero-Trust Delivery',
        'Compliance Sprints',
        'Vulnerability Backlogs',
        'SOC2 Audits',
      ],
      phone: '+880 1614-100004',
      location: 'Boalia, Rajshahi',
      bio: 'Squad Delta PM safeguarding security architectures in CampusLink BD and BazarTrack BD.',
    },
    {
      id: 'emp_pm_05',
      name: 'Kazi Tariqul Islam',
      email: 'tariqul.islam@pointfex.internal',
      title: 'AI Products Program Manager',
      initials: 'KT',
      avatarUrl: '',
      status: 'online',
      skills: [
        'MLOps Milestones',
        'Data Pipeline Sprints',
        'Vector Search Delivery',
        'Model Benchmarks',
      ],
      phone: '+880 1715-100005',
      location: 'Sonadanga, Khulna',
      bio: 'Squad Echo PM delivering BloodConnect BD and RentMate BD intelligent search features.',
    },
    {
      id: 'emp_pm_06',
      name: 'Farhana Rahman',
      email: 'farhana.rahman@pointfex.internal',
      title: 'Media & Streaming Delivery PM',
      initials: 'FR',
      avatarUrl: '',
      status: 'offline',
      skills: [
        'WebRTC Sprint Cycles',
        'Asset Pipeline Sprints',
        'Interactive Media UI',
        'Canvas Optimization',
      ],
      phone: '+880 1816-100006',
      location: 'Chasara, Narayanganj',
      bio: 'Squad Foxtrot PM overseeing real-time media and matchmaking systems in JobBridge BD and EventHut BD.',
    },

    // --- 24 DEVELOPERS (4 per Squad across 6 Teams) ---
    // Squad Alpha (Team 1) Developers
    {
      id: 'emp_dev_01',
      name: 'Fahim',
      email: 'fahim.dev@pointfex.internal',
      title: 'Lead Frontend Architect',
      initials: 'FH',
      avatarUrl: '',
      status: 'online',
      skills: ['React 19', 'TypeScript', 'Tailwind CSS', 'Vite', 'State Machines', 'GraphQL'],
      phone: '+880 1711-200001',
      location: 'Badda, Dhaka',
      bio: 'Primary developer and Lead Frontend Architect specializing in modular design systems and reactive state.',
    },
    {
      id: 'emp_dev_02',
      name: 'Mehedi Hasan',
      email: 'mehedi.hasan@pointfex.internal',
      title: 'Senior Full-Stack Engineer',
      initials: 'MH',
      avatarUrl: '',
      status: 'online',
      skills: ['Node.js', 'PostgreSQL', 'Prisma', 'React', 'Docker'],
      phone: '+880 1811-200002',
      location: 'Agrabad, Chattogram',
    },
    {
      id: 'emp_dev_03',
      name: 'Anika Tabassum',
      email: 'anika.tabassum@pointfex.internal',
      title: 'UI/UX & Frontend Engineer',
      initials: 'AT',
      avatarUrl: '',
      status: 'away',
      skills: ['Figma', 'React', 'CSS Modules', 'WCAG Accessibility', 'Storybook'],
      phone: '+880 1911-200003',
      location: 'Upashahar, Sylhet',
    },
    {
      id: 'emp_dev_04',
      name: 'Shakil Khan',
      email: 'shakil.khan@pointfex.internal',
      title: 'Backend & Systems Engineer',
      initials: 'SK',
      avatarUrl: '',
      status: 'online',
      skills: ['Go', 'Redis', 'Kafka', 'PostgreSQL', 'High-Concurrency'],
      phone: '+880 1611-200004',
      location: 'Motihar, Rajshahi',
    },

    // Squad Bravo (Team 2) Developers
    {
      id: 'emp_dev_05',
      name: 'Rashedul Karim',
      email: 'rashedul.karim@pointfex.internal',
      title: 'Senior Cloud Architect',
      initials: 'RK',
      status: 'online',
      skills: ['AWS', 'Kubernetes', 'Terraform', 'PostgreSQL'],
      phone: '+880 1711-200005',
      location: 'Uttara, Dhaka',
    },
    {
      id: 'emp_dev_06',
      name: 'Tasnim Akhter',
      email: 'tasnim.akhter@pointfex.internal',
      title: 'Fullstack Cloud Engineer',
      initials: 'TA',
      status: 'offline',
      skills: ['NestJS', 'React', 'Docker', 'Redis'],
      phone: '+880 1811-200006',
      location: 'Boyra, Khulna',
    },
    {
      id: 'emp_dev_07',
      name: 'Salman Farsi',
      email: 'salman.farsi@pointfex.internal',
      title: 'DevOps & CI/CD Specialist',
      initials: 'SF',
      status: 'online',
      skills: ['GitHub Actions', 'ArgoCD', 'Prometheus', 'Grafana'],
      phone: '+880 1911-200007',
      location: 'Mohakhali, Dhaka',
    },
    {
      id: 'emp_dev_08',
      name: 'Nazmul Huda',
      email: 'nazmul.huda@pointfex.internal',
      title: 'Cloud Infrastructure Dev',
      initials: 'NH',
      status: 'away',
      skills: ['Linux', 'Bash', 'Docker Swarm', 'Nginx'],
      phone: '+880 1611-200008',
      location: 'Sutrapur, Bogura',
    },

    // Squad Charlie (Team 3) Developers
    {
      id: 'emp_dev_09',
      name: 'Asif Iqbal',
      email: 'asif.iqbal@pointfex.internal',
      title: 'Lead Mobile Engineer',
      initials: 'AI',
      status: 'online',
      skills: ['React Native', 'Expo', 'Redux Toolkit', 'Offline Sync'],
      phone: '+880 1711-200009',
      location: 'Nasirabad, Chattogram',
    },
    {
      id: 'emp_dev_10',
      name: 'Sumaiya Akter',
      email: 'sumaiya.akter@pointfex.internal',
      title: 'Mobile UI/UX Developer',
      initials: 'SA',
      status: 'online',
      skills: ['React Native', 'Tailwind', 'Reanimated 3', 'TypeScript'],
      phone: '+880 1811-200010',
      location: 'Lalmatia, Dhaka',
    },
    {
      id: 'emp_dev_11',
      name: 'Zahid Hossain',
      email: 'zahid.hossain@pointfex.internal',
      title: 'Mobile API Backend Engineer',
      initials: 'ZH',
      status: 'away',
      skills: ['Node.js', 'Express', 'SQLite', 'WebSockets'],
      phone: '+880 1911-200011',
      location: 'Sadar, Barishal',
    },
    {
      id: 'emp_dev_12',
      name: 'Sharmin Sultana',
      email: 'sharmin.sultana@pointfex.internal',
      title: 'Mobile QA & Test Engineer',
      initials: 'SS',
      status: 'offline',
      skills: ['Jest', 'Detox', 'Appium', 'Cypress'],
      phone: '+880 1611-200012',
      location: 'Kandirpar, Comilla',
    },

    // Squad Delta (Team 4) Developers
    {
      id: 'emp_dev_13',
      name: 'Kamrul Islam',
      email: 'kamrul.islam@pointfex.internal',
      title: 'Lead Security Engineer',
      initials: 'KI',
      status: 'online',
      skills: ['OAuth 2.0', 'OIDC', 'Zero-Trust', 'Cryptography'],
      phone: '+880 1711-200013',
      location: 'Tejgaon, Dhaka',
    },
    {
      id: 'emp_dev_14',
      name: 'Farzana Yasmin',
      email: 'farzana.yasmin@pointfex.internal',
      title: 'Backend Security Engineer',
      initials: 'FY',
      status: 'online',
      skills: ['NestJS', 'PostgreSQL', 'Role-Based Access Control', 'Penetration Testing'],
      phone: '+880 1811-200014',
      location: 'Amberkhana, Sylhet',
    },
    {
      id: 'emp_dev_15',
      name: 'Mizanur Rahman',
      email: 'mizanur.rahman@pointfex.internal',
      title: 'Fullstack Security Dev',
      initials: 'MR',
      status: 'offline',
      skills: ['TypeScript', 'Node.js', 'WASM', 'Data Sanitization'],
      phone: '+880 1911-200015',
      location: 'Town Hall, Mymensingh',
    },
    {
      id: 'emp_dev_16',
      name: 'Jannatul Ferdous',
      email: 'jannatul.ferdous@pointfex.internal',
      title: 'Frontend Security Dev',
      initials: 'JF',
      status: 'online',
      skills: ['React', 'CSP Headers', 'Sanitize-HTML', 'OWASP Top 10'],
      phone: '+880 1611-200016',
      location: 'Jahaj Company, Rangpur',
    },

    // Squad Echo (Team 5) Developers
    {
      id: 'emp_dev_17',
      name: 'Shahriar Kabir',
      email: 'shahriar.kabir@pointfex.internal',
      title: 'Lead AI/ML Engineer',
      initials: 'SK',
      status: 'online',
      skills: ['Python', 'PyTorch', 'FastAPI', 'LangChain', 'Vector DBs'],
      phone: '+880 1711-200017',
      location: 'Eskaton, Dhaka',
    },
    {
      id: 'emp_dev_18',
      name: 'Nabila Haque',
      email: 'nabila.haque@pointfex.internal',
      title: 'ML Pipeline & Data Dev',
      initials: 'NH',
      status: 'away',
      skills: ['Pandas', 'NumPy', 'Airflow', 'Embedding Pipelines'],
      phone: '+880 1811-200018',
      location: 'Kazihata, Rajshahi',
    },
    {
      id: 'emp_dev_19',
      name: 'Towhidul Islam',
      email: 'towhidul.islam@pointfex.internal',
      title: 'Vector DB & Search Dev',
      initials: 'TI',
      status: 'online',
      skills: ['Qdrant', 'Pinecone', 'PostgreSQL pgvector', 'HNSW Indexing'],
      phone: '+880 1911-200019',
      location: 'Chowrasta, Gazipur',
    },
    {
      id: 'emp_dev_20',
      name: 'Rumana Afroz',
      email: 'rumana.afroz@pointfex.internal',
      title: 'MLOps & Inference Dev',
      initials: 'RA',
      status: 'online',
      skills: ['Docker', 'ONNX Runtime', 'Triton', 'FastAPI'],
      phone: '+880 1611-200020',
      location: 'Shyamoli, Dhaka',
    },

    // Squad Foxtrot (Team 6) Developers
    {
      id: 'emp_dev_21',
      name: 'Golam Sarwar',
      email: 'golam.sarwar@pointfex.internal',
      title: 'Lead Media & Streaming Dev',
      initials: 'GS',
      status: 'online',
      skills: ['WebRTC', 'MediaSoup', 'FFmpeg', 'HLS/DASH'],
      phone: '+880 1711-200021',
      location: 'GEC Circle, Chattogram',
    },
    {
      id: 'emp_dev_22',
      name: 'Sanjida Parveen',
      email: 'sanjida.parveen@pointfex.internal',
      title: 'Real-Time Audio/Video Dev',
      initials: 'SP',
      status: 'offline',
      skills: ['WebRTC', 'Socket.IO', 'Canvas AudioContext', 'Signaling'],
      phone: '+880 1811-200022',
      location: 'Khilgaon, Dhaka',
    },
    {
      id: 'emp_dev_23',
      name: 'Ashraful Alam',
      email: 'ashraful.alam@pointfex.internal',
      title: 'WebGL & Graphics Dev',
      initials: 'AA',
      status: 'online',
      skills: ['WebGL', 'Three.js', 'Canvas 2D', 'Shader Programming'],
      phone: '+880 1911-200023',
      location: 'Rupsha, Khulna',
    },
    {
      id: 'emp_dev_24',
      name: 'Fahmida Akter',
      email: 'fahmida.akter@pointfex.internal',
      title: 'Fullstack Media Engineer',
      initials: 'FA',
      status: 'away',
      skills: ['TypeScript', 'React', 'NestJS', 'Asset Processing'],
      phone: '+880 1611-200024',
      location: 'Tanbazar, Narayanganj',
    },
  ]

  for (const emp of employees) {
    const normalizedEmp = {
      ...emp,
      avatarUrl: (emp as { avatarUrl?: string }).avatarUrl ?? '',
    }
    await prisma.employee.upsert({
      where: { id: emp.id },
      update: normalizedEmp,
      create: normalizedEmp,
    })
  }

  // --------------------------------------------------------------------------
  // 3. POSITION ASSIGNMENTS (Connecting Employees with Positions)
  // --------------------------------------------------------------------------
  console.log('  -> Seeding Position Assignments (Preserving Temporal History)...')

  const assignments = [
    // Executives
    { id: 'asgn_ceo', employeeId: 'emp_ceo_01', positionId: 'pos_ceo' },
    { id: 'asgn_cto', employeeId: 'emp_cto_01', positionId: 'pos_cto' },
    { id: 'asgn_cfo', employeeId: 'emp_cfo_01', positionId: 'pos_cfo' },
    { id: 'asgn_chro', employeeId: 'emp_chro_01', positionId: 'pos_chro' },

    // PMs
    { id: 'asgn_pm_01', employeeId: 'emp_pm_01', positionId: 'pos_pm_01' },
    { id: 'asgn_pm_02', employeeId: 'emp_pm_02', positionId: 'pos_pm_02' },
    { id: 'asgn_pm_03', employeeId: 'emp_pm_03', positionId: 'pos_pm_03' },
    { id: 'asgn_pm_04', employeeId: 'emp_pm_04', positionId: 'pos_pm_04' },
    { id: 'asgn_pm_05', employeeId: 'emp_pm_05', positionId: 'pos_pm_05' },
    { id: 'asgn_pm_06', employeeId: 'emp_pm_06', positionId: 'pos_pm_06' },

    // Developers (DEV-01 to DEV-24)
    ...Array.from({ length: 24 }).map((_, i) => {
      const num = String(i + 1).padStart(2, '0')
      return {
        id: `asgn_dev_${num}`,
        employeeId: `emp_dev_${num}`,
        positionId: `pos_dev_${num}`,
      }
    }),
  ]

  for (const asgn of assignments) {
    await prisma.positionAssignment.upsert({
      where: { id: asgn.id },
      update: {
        employeeId: asgn.employeeId,
        positionId: asgn.positionId,
        isActive: true,
      },
      create: {
        id: asgn.id,
        employeeId: asgn.employeeId,
        positionId: asgn.positionId,
        startDate: new Date('2026-01-01'),
        isActive: true,
      },
    })
  }

  // --------------------------------------------------------------------------
  // 4. TEAMS (6 Squads With Dedicated PM Positions)
  // --------------------------------------------------------------------------
  console.log('  -> Seeding Teams (Alpha through Foxtrot)...')

  const teams = [
    {
      id: 'team_01',
      name: 'Team Alpha — Quantum Core',
      code: 'TA',
      focus: 'Enterprise Frontend Architecture, High-Concurrency APIs, & Governance',
      pmPositionId: 'pos_pm_01',
      color: '#38bdf8', // sky
      currentSprintWeek: 3,
      totalSprintWeeks: 5,
      health: 'on_track',
      weeklyVelocity: 42,
    },
    {
      id: 'team_02',
      name: 'Team Bravo — Nexus Cloud',
      code: 'TB',
      focus: 'Multi-Tenant Microservices, Kubernetes Provisioning & Cloud Reliability',
      pmPositionId: 'pos_pm_02',
      color: '#818cf8', // indigo
      currentSprintWeek: 3,
      totalSprintWeeks: 5,
      health: 'on_track',
      weeklyVelocity: 38,
    },
    {
      id: 'team_03',
      name: 'Team Charlie — Apex Mobility',
      code: 'TC',
      focus: 'Cross-Platform React Native, Offline Data Sync & Geolocation Services',
      pmPositionId: 'pos_pm_03',
      color: '#34d399', // emerald
      currentSprintWeek: 3,
      totalSprintWeeks: 5,
      health: 'needs_attention',
      weeklyVelocity: 31,
    },
    {
      id: 'team_04',
      name: 'Team Delta — Sentinel Security',
      code: 'TD',
      focus: 'Zero-Trust Authentication, RBAC, WAF Protections, & SOC2 Compliance',
      pmPositionId: 'pos_pm_04',
      color: '#f87171', // rose
      currentSprintWeek: 3,
      totalSprintWeeks: 5,
      health: 'on_track',
      weeklyVelocity: 36,
    },
    {
      id: 'team_05',
      name: 'Team Echo — Horizon AI',
      code: 'TE',
      focus: 'LLM Multi-Agent Orchestration, Vector Search, & Bengali NLP Pipelines',
      pmPositionId: 'pos_pm_05',
      color: '#c084fc', // purple
      currentSprintWeek: 3,
      totalSprintWeeks: 5,
      health: 'on_track',
      weeklyVelocity: 44,
    },
    {
      id: 'team_06',
      name: 'Team Foxtrot — Pulse Media',
      code: 'TF',
      focus: 'Low-Latency WebRTC Telemetry, Asset Transcoding & Interactive Canvas UI',
      pmPositionId: 'pos_pm_06',
      color: '#fbbf24', // amber
      currentSprintWeek: 3,
      totalSprintWeeks: 5,
      health: 'on_track',
      weeklyVelocity: 39,
    },
  ]

  for (const team of teams) {
    await prisma.team.upsert({
      where: { id: team.id },
      update: team,
      create: team,
    })
  }

  // --------------------------------------------------------------------------
  // 5. TEAM MEMBERSHIPS (4 Developers per Squad)
  // --------------------------------------------------------------------------
  console.log('  -> Seeding Team Memberships...')

  const memberships = [
    // Team Alpha
    {
      id: 'tm_01_1',
      teamId: 'team_01',
      employeeId: 'emp_dev_01',
      isLead: true,
      roleInTeam: 'lead_developer',
    },
    {
      id: 'tm_01_2',
      teamId: 'team_01',
      employeeId: 'emp_dev_02',
      isLead: false,
      roleInTeam: 'developer',
    },
    {
      id: 'tm_01_3',
      teamId: 'team_01',
      employeeId: 'emp_dev_03',
      isLead: false,
      roleInTeam: 'developer',
    },
    {
      id: 'tm_01_4',
      teamId: 'team_01',
      employeeId: 'emp_dev_04',
      isLead: false,
      roleInTeam: 'developer',
    },

    // Team Bravo
    {
      id: 'tm_02_1',
      teamId: 'team_02',
      employeeId: 'emp_dev_05',
      isLead: true,
      roleInTeam: 'lead_developer',
    },
    {
      id: 'tm_02_2',
      teamId: 'team_02',
      employeeId: 'emp_dev_06',
      isLead: false,
      roleInTeam: 'developer',
    },
    {
      id: 'tm_02_3',
      teamId: 'team_02',
      employeeId: 'emp_dev_07',
      isLead: false,
      roleInTeam: 'developer',
    },
    {
      id: 'tm_02_4',
      teamId: 'team_02',
      employeeId: 'emp_dev_08',
      isLead: false,
      roleInTeam: 'developer',
    },

    // Team Charlie
    {
      id: 'tm_03_1',
      teamId: 'team_03',
      employeeId: 'emp_dev_09',
      isLead: true,
      roleInTeam: 'lead_developer',
    },
    {
      id: 'tm_03_2',
      teamId: 'team_03',
      employeeId: 'emp_dev_10',
      isLead: false,
      roleInTeam: 'developer',
    },
    {
      id: 'tm_03_3',
      teamId: 'team_03',
      employeeId: 'emp_dev_11',
      isLead: false,
      roleInTeam: 'developer',
    },
    {
      id: 'tm_03_4',
      teamId: 'team_03',
      employeeId: 'emp_dev_12',
      isLead: false,
      roleInTeam: 'developer',
    },

    // Team Delta
    {
      id: 'tm_04_1',
      teamId: 'team_04',
      employeeId: 'emp_dev_13',
      isLead: true,
      roleInTeam: 'lead_developer',
    },
    {
      id: 'tm_04_2',
      teamId: 'team_04',
      employeeId: 'emp_dev_14',
      isLead: false,
      roleInTeam: 'developer',
    },
    {
      id: 'tm_04_3',
      teamId: 'team_04',
      employeeId: 'emp_dev_15',
      isLead: false,
      roleInTeam: 'developer',
    },
    {
      id: 'tm_04_4',
      teamId: 'team_04',
      employeeId: 'emp_dev_16',
      isLead: false,
      roleInTeam: 'developer',
    },

    // Team Echo
    {
      id: 'tm_05_1',
      teamId: 'team_05',
      employeeId: 'emp_dev_17',
      isLead: true,
      roleInTeam: 'lead_developer',
    },
    {
      id: 'tm_05_2',
      teamId: 'team_05',
      employeeId: 'emp_dev_18',
      isLead: false,
      roleInTeam: 'developer',
    },
    {
      id: 'tm_05_3',
      teamId: 'team_05',
      employeeId: 'emp_dev_19',
      isLead: false,
      roleInTeam: 'developer',
    },
    {
      id: 'tm_05_4',
      teamId: 'team_05',
      employeeId: 'emp_dev_20',
      isLead: false,
      roleInTeam: 'developer',
    },

    // Team Foxtrot
    {
      id: 'tm_06_1',
      teamId: 'team_06',
      employeeId: 'emp_dev_21',
      isLead: true,
      roleInTeam: 'lead_developer',
    },
    {
      id: 'tm_06_2',
      teamId: 'team_06',
      employeeId: 'emp_dev_22',
      isLead: false,
      roleInTeam: 'developer',
    },
    {
      id: 'tm_06_3',
      teamId: 'team_06',
      employeeId: 'emp_dev_23',
      isLead: false,
      roleInTeam: 'developer',
    },
    {
      id: 'tm_06_4',
      teamId: 'team_06',
      employeeId: 'emp_dev_24',
      isLead: false,
      roleInTeam: 'developer',
    },
  ]

  for (const tm of memberships) {
    await prisma.teamMembership.upsert({
      where: { id: tm.id },
      update: tm,
      create: tm,
    })
  }

  // --------------------------------------------------------------------------
  // 6. 12 BANGLADESH-ORIENTED PROJECTS (2 Per Squad)
  // --------------------------------------------------------------------------
  console.log('  -> Seeding 12 Bangladesh-Oriented Projects & Budgets...')

  const projects = [
    // Team Alpha Projects
    {
      id: 'proj_01',
      name: 'Unseen Bangladesh',
      code: 'UBD-01',
      description:
        'Nationwide heritage tourism, 64-district eco-trail guide, and cultural artifact discovery platform.',
      status: 'in_progress',
      progress: 72,
      health: 'on_track',
      startDate: new Date('2026-10-12'),
      deadline: new Date('2026-11-20'),
      totalWeeks: 5,
      currentWeek: 3,
      budget: new Prisma.Decimal(45000.0),
      allocatedBudget: new Prisma.Decimal(32000.0),
      clientRevenue: new Prisma.Decimal(85000.0),
      client: 'Bangladesh Tourism Board (BTB Demo)',
      priority: 'High Priority',
      repositoryUrl: 'https://github.com/pointfex/unseen-bangladesh',
      demoUrl: 'https://unseenbd.pointfex.internal',
      tags: ['React 19', 'GIS Maps', 'Vite', 'TypeScript', 'Tailwind'],
      color: '#38bdf8',
      srsTitle: 'UBD-01-SRS-EcoTourism-v2.1.pdf',
      srsUrl: 'https://docs.pointfex.internal/srs/UBD-01-v2.1.pdf',
      srsVersion: 'v2.1 (Approved)',
      srsOverview:
        'System requirements for GPS location mapping across 64 districts, offline trail caching, and homestay verification.',
      srsRequirementsCount: 28,
    },
    {
      id: 'proj_02',
      name: 'Ghush.com',
      code: 'GHC-02',
      description:
        'Secure, zero-knowledge anonymous public complaint and anti-bribery whistleblower transparency portal.',
      status: 'in_progress',
      progress: 58,
      health: 'on_track',
      startDate: new Date('2026-10-12'),
      deadline: new Date('2026-11-20'),
      totalWeeks: 5,
      currentWeek: 3,
      budget: new Prisma.Decimal(38000.0),
      allocatedBudget: new Prisma.Decimal(26000.0),
      clientRevenue: new Prisma.Decimal(62000.0),
      client: 'Transparency Civil Society Consortium',
      priority: 'Critical Path',
      repositoryUrl: 'https://github.com/pointfex/ghush-com-portal',
      demoUrl: 'https://ghush.pointfex.internal',
      tags: ['Zero-Knowledge', 'PostgreSQL', 'Anonymity', 'Next.js'],
      color: '#818cf8',
      srsTitle: 'GHC-02-SRS-Whistleblower-v1.8.pdf',
      srsUrl: 'https://docs.pointfex.internal/srs/GHC-02-v1.8.pdf',
      srsVersion: 'v1.8 (Approved)',
      srsOverview:
        'Requirements for client-side document redaction, metadata scrubbing, and cryptographic receipt issuance.',
      srsRequirementsCount: 24,
    },

    // Team Bravo Projects
    {
      id: 'proj_03',
      name: 'EduConnect BD',
      code: 'ECB-03',
      description:
        'National digital curriculum, inter-school digital resource sharing, and remote classroom collaboration platform.',
      status: 'in_progress',
      progress: 65,
      health: 'on_track',
      startDate: new Date('2026-10-12'),
      deadline: new Date('2026-11-20'),
      totalWeeks: 5,
      currentWeek: 3,
      budget: new Prisma.Decimal(40000.0),
      allocatedBudget: new Prisma.Decimal(28000.0),
      clientRevenue: new Prisma.Decimal(78000.0),
      client: 'National E-Learning Initiative',
      priority: 'High Priority',
      repositoryUrl: 'https://github.com/pointfex/educonnect-bd',
      demoUrl: 'https://educonnect.pointfex.internal',
      tags: ['NestJS', 'Microservices', 'PostgreSQL', 'Docker'],
      color: '#818cf8',
    },
    {
      id: 'proj_04',
      name: 'ShebaFinder',
      code: 'SBF-04',
      description:
        'Hyperlocal verified household technician, electrician, plumber, and emergency repair discovery platform.',
      status: 'in_progress',
      progress: 61,
      health: 'on_track',
      startDate: new Date('2026-10-12'),
      deadline: new Date('2026-11-20'),
      totalWeeks: 5,
      currentWeek: 3,
      budget: new Prisma.Decimal(35000.0),
      allocatedBudget: new Prisma.Decimal(22600.0),
      clientRevenue: new Prisma.Decimal(65000.0),
      client: 'Metropolitan Services Union',
      priority: 'Medium Priority',
      repositoryUrl: 'https://github.com/pointfex/sheba-finder',
      demoUrl: 'https://shebafinder.pointfex.internal',
      tags: ['Cloud', 'Redis', 'Node.js', 'React'],
      color: '#34d399',
    },

    // Team Charlie Projects
    {
      id: 'proj_05',
      name: 'KrishiBondhu',
      code: 'KBD-05',
      description:
        'Farmer agricultural advisory, visual crop pest diagnosis, and wholesale mandi price intelligence network.',
      status: 'in_progress',
      progress: 49,
      health: 'needs_attention',
      startDate: new Date('2026-10-12'),
      deadline: new Date('2026-11-20'),
      totalWeeks: 5,
      currentWeek: 3,
      budget: new Prisma.Decimal(32000.0),
      allocatedBudget: new Prisma.Decimal(20000.0),
      clientRevenue: new Prisma.Decimal(54000.0),
      client: 'AgriTech Foundation Bangladesh',
      priority: 'High Priority',
      repositoryUrl: 'https://github.com/pointfex/krishi-bondhu-mobile',
      demoUrl: 'https://krishibondhu.pointfex.internal',
      tags: ['React Native', 'Offline-First', 'Image AI', 'SQLite'],
      color: '#34d399',
    },
    {
      id: 'proj_06',
      name: 'Dhaka Traffic Watch',
      code: 'DTW-06',
      description:
        'Crowdsourced urban commute congestion radar, metro rail schedules, and arterial bottleneck alerts.',
      status: 'in_progress',
      progress: 54,
      health: 'on_track',
      startDate: new Date('2026-10-12'),
      deadline: new Date('2026-11-20'),
      totalWeeks: 5,
      currentWeek: 3,
      budget: new Prisma.Decimal(30000.0),
      allocatedBudget: new Prisma.Decimal(18000.0),
      clientRevenue: new Prisma.Decimal(48000.0),
      client: 'Dhaka Urban Transport Council',
      priority: 'Critical Path',
      repositoryUrl: 'https://github.com/pointfex/dhaka-traffic-watch',
      demoUrl: 'https://trafficwatch.pointfex.internal',
      tags: ['GPS Telemetry', 'Leaflet', 'React Native', 'WebSockets'],
      color: '#f87171',
    },

    // Team Delta Projects
    {
      id: 'proj_07',
      name: 'CampusLink BD',
      code: 'CLB-07',
      description:
        'Inter-university verified student portfolio, academic research exchange, and alumni mentorship hub.',
      status: 'in_progress',
      progress: 68,
      health: 'on_track',
      startDate: new Date('2026-10-12'),
      deadline: new Date('2026-11-20'),
      totalWeeks: 5,
      currentWeek: 3,
      budget: new Prisma.Decimal(30000.0),
      allocatedBudget: new Prisma.Decimal(19000.0),
      clientRevenue: new Prisma.Decimal(52000.0),
      client: 'Higher Education Digital Trust',
      priority: 'High Priority',
      repositoryUrl: 'https://github.com/pointfex/campuslink-bd',
      demoUrl: 'https://campuslink.pointfex.internal',
      tags: ['Zero-Trust', 'OAuth2', 'RBAC', 'TypeScript'],
      color: '#f87171',
    },
    {
      id: 'proj_08',
      name: 'BazarTrack BD',
      code: 'BTB-08',
      description:
        'Daily essential commodity market price tracking, anti-syndicate price disparity, and inflation indices.',
      status: 'in_progress',
      progress: 60,
      health: 'on_track',
      startDate: new Date('2026-10-12'),
      deadline: new Date('2026-11-20'),
      totalWeeks: 5,
      currentWeek: 3,
      budget: new Prisma.Decimal(28000.0),
      allocatedBudget: new Prisma.Decimal(16000.0),
      clientRevenue: new Prisma.Decimal(45000.0),
      client: 'Consumer Rights Forum Bangladesh',
      priority: 'Medium Priority',
      repositoryUrl: 'https://github.com/pointfex/bazartrack-bd',
      demoUrl: 'https://bazartrack.pointfex.internal',
      tags: ['Market Data', 'PostgreSQL', 'Charts', 'Next.js'],
      color: '#c084fc',
    },

    // Team Echo Projects
    {
      id: 'proj_09',
      name: 'BloodConnect BD',
      code: 'BCB-09',
      description:
        'Emergency voluntary blood donor geolocation matching network with rare group automated broadcast SMS.',
      status: 'in_progress',
      progress: 74,
      health: 'on_track',
      startDate: new Date('2026-10-12'),
      deadline: new Date('2026-11-20'),
      totalWeeks: 5,
      currentWeek: 3,
      budget: new Prisma.Decimal(36000.0),
      allocatedBudget: new Prisma.Decimal(24000.0),
      clientRevenue: new Prisma.Decimal(68000.0),
      client: 'Red Crescent Partner Network',
      priority: 'High Priority',
      repositoryUrl: 'https://github.com/pointfex/bloodconnect-bd',
      demoUrl: 'https://bloodconnect.pointfex.internal',
      tags: ['Vector DB', 'SMS Gateway', 'FastAPI', 'Python'],
      color: '#c084fc',
    },
    {
      id: 'proj_10',
      name: 'RentMate BD',
      code: 'RMB-10',
      description:
        'Verified bachelor, family, and sublet rental accommodation discovery platform with landlord fraud checks.',
      status: 'in_progress',
      progress: 52,
      health: 'on_track',
      startDate: new Date('2026-10-12'),
      deadline: new Date('2026-11-20'),
      totalWeeks: 5,
      currentWeek: 3,
      budget: new Prisma.Decimal(26000.0),
      allocatedBudget: new Prisma.Decimal(16000.0),
      clientRevenue: new Prisma.Decimal(42000.0),
      client: 'Urban Housing Advisory BD',
      priority: 'Medium Priority',
      repositoryUrl: 'https://github.com/pointfex/rentmate-bd',
      demoUrl: 'https://rentmate.pointfex.internal',
      tags: ['Search AI', 'PostgreSQL', 'Tailwind', 'React'],
      color: '#fbbf24',
    },

    // Team Foxtrot Projects
    {
      id: 'proj_11',
      name: 'JobBridge BD',
      code: 'JBB-11',
      description:
        'Entry-level tech graduate matching platform, code challenge verification, and verified internship portal.',
      status: 'in_progress',
      progress: 63,
      health: 'on_track',
      startDate: new Date('2026-10-12'),
      deadline: new Date('2026-11-20'),
      totalWeeks: 5,
      currentWeek: 3,
      budget: new Prisma.Decimal(22000.0),
      allocatedBudget: new Prisma.Decimal(14000.0),
      clientRevenue: new Prisma.Decimal(38000.0),
      client: 'Software Industry Employment Exchange',
      priority: 'High Priority',
      repositoryUrl: 'https://github.com/pointfex/jobbridge-bd',
      demoUrl: 'https://jobbridge.pointfex.internal',
      tags: ['WebRTC Video', 'Code Execution', 'NestJS', 'React'],
      color: '#fbbf24',
    },
    {
      id: 'proj_12',
      name: 'EventHut BD',
      code: 'EHB-12',
      description:
        'Tech summit, university hackathon, and developer workshop ticketing and livestreaming portal.',
      status: 'in_progress',
      progress: 48,
      health: 'on_track',
      startDate: new Date('2026-10-12'),
      deadline: new Date('2026-11-20'),
      totalWeeks: 5,
      currentWeek: 3,
      budget: new Prisma.Decimal(18000.0),
      allocatedBudget: new Prisma.Decimal(10000.0),
      clientRevenue: new Prisma.Decimal(30000.0),
      client: 'Tech Community Bangladesh',
      priority: 'Medium Priority',
      repositoryUrl: 'https://github.com/pointfex/eventhut-bd',
      demoUrl: 'https://eventhut.pointfex.internal',
      tags: ['Canvas 2D', 'Livestreaming', 'Next.js', 'Tailwind'],
      color: '#38bdf8',
    },
  ]

  for (const proj of projects) {
    await prisma.project.upsert({
      where: { id: proj.id },
      update: proj,
      create: proj,
    })
  }

  // Bind projects to teams via TeamProject table
  const teamProjectMappings = [
    { id: 'tp_01_1', teamId: 'team_01', projectId: 'proj_01' },
    { id: 'tp_01_2', teamId: 'team_01', projectId: 'proj_02' },
    { id: 'tp_02_1', teamId: 'team_02', projectId: 'proj_03' },
    { id: 'tp_02_2', teamId: 'team_02', projectId: 'proj_04' },
    { id: 'tp_03_1', teamId: 'team_03', projectId: 'proj_05' },
    { id: 'tp_03_2', teamId: 'team_03', projectId: 'proj_06' },
    { id: 'tp_04_1', teamId: 'team_04', projectId: 'proj_07' },
    { id: 'tp_04_2', teamId: 'team_04', projectId: 'proj_08' },
    { id: 'tp_05_1', teamId: 'team_05', projectId: 'proj_09' },
    { id: 'tp_05_2', teamId: 'team_05', projectId: 'proj_10' },
    { id: 'tp_06_1', teamId: 'team_06', projectId: 'proj_11' },
    { id: 'tp_06_2', teamId: 'team_06', projectId: 'proj_12' },
  ]

  for (const tp of teamProjectMappings) {
    await prisma.teamProject.upsert({
      where: { id: tp.id },
      update: tp,
      create: tp,
    })
  }

  // --------------------------------------------------------------------------
  // 7. PROJECT MILESTONES
  // --------------------------------------------------------------------------
  console.log('  -> Seeding Project Milestones...')

  const milestones = [
    {
      id: 'ms_01_1',
      projectId: 'proj_01',
      title: 'M1: SRS & Architectural Sign-Off',
      dueDate: new Date('2026-10-18'),
      status: 'completed',
      progress: 100,
      sprintWeek: 1,
      payoutAmount: new Prisma.Decimal(8000.0),
    },
    {
      id: 'ms_01_2',
      projectId: 'proj_01',
      title: 'M2: 64-District GIS Map Layer Ingestion',
      dueDate: new Date('2026-10-28'),
      status: 'completed',
      progress: 100,
      sprintWeek: 2,
      payoutAmount: new Prisma.Decimal(12000.0),
    },
    {
      id: 'ms_01_3',
      projectId: 'proj_01',
      title: 'M3: Offline Homestay Caching & Verification',
      dueDate: new Date('2026-11-08'),
      status: 'in_progress',
      progress: 65,
      sprintWeek: 3,
      payoutAmount: new Prisma.Decimal(12000.0),
    },
    {
      id: 'ms_01_4',
      projectId: 'proj_01',
      title: 'M4: Stress Testing & Pilot Launch',
      dueDate: new Date('2026-11-20'),
      status: 'pending',
      progress: 0,
      sprintWeek: 5,
      payoutAmount: new Prisma.Decimal(13000.0),
    },

    {
      id: 'ms_02_1',
      projectId: 'proj_02',
      title: 'M1: Cryptographic Anonymity Architecture',
      dueDate: new Date('2026-10-16'),
      status: 'completed',
      progress: 100,
      sprintWeek: 1,
      payoutAmount: new Prisma.Decimal(7000.0),
    },
    {
      id: 'ms_02_2',
      projectId: 'proj_02',
      title: 'M2: Client-Side Document Redactor',
      dueDate: new Date('2026-10-27'),
      status: 'completed',
      progress: 100,
      sprintWeek: 2,
      payoutAmount: new Prisma.Decimal(10000.0),
    },
    {
      id: 'ms_02_3',
      projectId: 'proj_02',
      title: 'M3: Zero-Knowledge Complaint Verification',
      dueDate: new Date('2026-11-10'),
      status: 'in_progress',
      progress: 45,
      sprintWeek: 3,
      payoutAmount: new Prisma.Decimal(9000.0),
    },
    {
      id: 'ms_02_4',
      projectId: 'proj_02',
      title: 'M4: Security Audit & Public Rollout',
      dueDate: new Date('2026-11-20'),
      status: 'pending',
      progress: 0,
      sprintWeek: 5,
      payoutAmount: new Prisma.Decimal(12000.0),
    },
  ]

  for (const ms of milestones) {
    await prisma.projectMilestone.upsert({
      where: { id: ms.id },
      update: ms,
      create: ms,
    })
  }

  // --------------------------------------------------------------------------
  // 8. COMPANY TREASURY (Consistent Financial Baseline)
  // --------------------------------------------------------------------------
  console.log('  -> Seeding Consistent Company Treasury (BDT ৳)...')

  await prisma.companyTreasury.upsert({
    where: { id: 'singleton' },
    update: {
      initialCapital: new Prisma.Decimal(500000.0),
      totalApprovedBudgets: new Prisma.Decimal(380000.0),
      totalDistributedToDevs: new Prisma.Decimal(245600.0),
      unallocatedReserves: new Prisma.Decimal(120000.0),
      totalClientRevenue: new Prisma.Decimal(740000.0),
      currency: 'BDT',
    },
    create: {
      id: 'singleton',
      initialCapital: new Prisma.Decimal(500000.0),
      totalApprovedBudgets: new Prisma.Decimal(380000.0),
      totalDistributedToDevs: new Prisma.Decimal(245600.0),
      unallocatedReserves: new Prisma.Decimal(120000.0),
      totalClientRevenue: new Prisma.Decimal(740000.0),
      currency: 'BDT',
    },
  })

  // --------------------------------------------------------------------------
  // 9. EMPLOYEE WALLETS
  // --------------------------------------------------------------------------
  console.log('  -> Seeding Employee Wallets in BDT (৳)...')

  const wallets = [
    // Primary Developer: Fahim (emp_dev_01)
    {
      id: 'wal_dev_01',
      employeeId: 'emp_dev_01',
      balance: new Prisma.Decimal(15400.0),
      currency: 'BDT',
      currencySymbol: '৳',
      pendingEscrow: new Prisma.Decimal(4500.0),
      totalEarnedToDate: new Prisma.Decimal(38500.0),
      totalPenalties: new Prisma.Decimal(1000.0),
      hourlyRateEquivalent: new Prisma.Decimal(450.0),
      sprintBonusEarned: new Prisma.Decimal(2500.0),
      totalSpendings: new Prisma.Decimal(0.0),
      lastPayoutDate: new Date('2026-10-28'),
      nextScheduledPayout: new Date('2026-11-15'),
    },
    // PM 01: Jihad
    {
      id: 'wal_pm_01',
      employeeId: 'emp_pm_01',
      balance: new Prisma.Decimal(22500.0),
      currency: 'BDT',
      currencySymbol: '৳',
      pendingEscrow: new Prisma.Decimal(6000.0),
      totalEarnedToDate: new Prisma.Decimal(54000.0),
      totalPenalties: new Prisma.Decimal(0.0),
      hourlyRateEquivalent: new Prisma.Decimal(650.0),
      sprintBonusEarned: new Prisma.Decimal(4500.0),
      totalSpendings: new Prisma.Decimal(1200.0),
      lastPayoutDate: new Date('2026-10-28'),
      nextScheduledPayout: new Date('2026-11-15'),
    },
    // CTO: Abir
    {
      id: 'wal_cto_01',
      employeeId: 'emp_cto_01',
      balance: new Prisma.Decimal(35000.0),
      currency: 'BDT',
      currencySymbol: '৳',
      pendingEscrow: new Prisma.Decimal(10000.0),
      totalEarnedToDate: new Prisma.Decimal(95000.0),
      totalPenalties: new Prisma.Decimal(0.0),
      hourlyRateEquivalent: new Prisma.Decimal(1200.0),
      sprintBonusEarned: new Prisma.Decimal(8000.0),
      totalSpendings: new Prisma.Decimal(2500.0),
      lastPayoutDate: new Date('2026-10-28'),
      nextScheduledPayout: new Date('2026-11-15'),
    },
    // CFO: Rahid
    {
      id: 'wal_cfo_01',
      employeeId: 'emp_cfo_01',
      balance: new Prisma.Decimal(32000.0),
      currency: 'BDT',
      currencySymbol: '৳',
      pendingEscrow: new Prisma.Decimal(8000.0),
      totalEarnedToDate: new Prisma.Decimal(88000.0),
      totalPenalties: new Prisma.Decimal(0.0),
      hourlyRateEquivalent: new Prisma.Decimal(1100.0),
      sprintBonusEarned: new Prisma.Decimal(7000.0),
      totalSpendings: new Prisma.Decimal(1800.0),
      lastPayoutDate: new Date('2026-10-28'),
      nextScheduledPayout: new Date('2026-11-15'),
    },
  ]

  // Add default wallets for remaining personnel
  for (let i = 2; i <= 24; i++) {
    const num = String(i).padStart(2, '0')
    wallets.push({
      id: `wal_dev_${num}`,
      employeeId: `emp_dev_${num}`,
      balance: new Prisma.Decimal(9000.0),
      currency: 'BDT',
      currencySymbol: '৳',
      pendingEscrow: new Prisma.Decimal(3000.0),
      totalEarnedToDate: new Prisma.Decimal(24000.0),
      totalPenalties: new Prisma.Decimal(0.0),
      hourlyRateEquivalent: new Prisma.Decimal(400.0),
      sprintBonusEarned: new Prisma.Decimal(1500.0),
      totalSpendings: new Prisma.Decimal(0.0),
      lastPayoutDate: new Date('2026-10-28'),
      nextScheduledPayout: new Date('2026-11-15'),
    })
  }

  for (const w of wallets) {
    await prisma.employeeWallet.upsert({
      where: { employeeId: w.employeeId },
      update: w,
      create: w,
    })
  }

  // --------------------------------------------------------------------------
  // 10. FINANCIAL TRANSACTIONS LEDGER
  // --------------------------------------------------------------------------
  console.log('  -> Seeding Financial Transaction Ledger...')

  const transactions = [
    {
      id: 'tx_01',
      walletId: 'wal_dev_01',
      employeeId: 'emp_dev_01',
      projectId: 'proj_01',
      milestoneId: 'ms_01_2',
      amount: new Prisma.Decimal(6400.0),
      type: 'milestone_payout',
      description: 'Sprint 2 Milestone Payout: 64-District GIS Map Ingestion sign-off',
      status: 'completed',
      createdAt: new Date('2026-10-28'),
    },
    {
      id: 'tx_penalty_01',
      walletId: 'wal_dev_01',
      employeeId: 'emp_dev_01',
      projectId: 'proj_01',
      amount: new Prisma.Decimal(-600.0),
      type: 'penalty',
      description: 'Sev-1 Regression: Map rendering memory leak under load test',
      status: 'deducted',
      reason: 'SLA Breach Penalty',
      createdAt: new Date('2026-10-30'),
    },
    {
      id: 'tx_bonus_01',
      walletId: 'wal_dev_01',
      employeeId: 'emp_dev_01',
      projectId: 'proj_01',
      amount: new Prisma.Decimal(1200.0),
      type: 'bonus',
      description: 'Sprint 2 Velocity & Clean Architecture Accolade',
      status: 'completed',
      reason: 'Architecture Excellence',
      createdAt: new Date('2026-10-29'),
    },
    {
      id: 'tx_alloc_01',
      employeeId: 'emp_dev_01',
      projectId: 'proj_01',
      amount: new Prisma.Decimal(5000.0),
      type: 'budget_allocation',
      description: 'Sprint 3 Week 3 Dev Budget Allocation for Unseen Bangladesh',
      status: 'allocated',
      createdAt: new Date('2026-11-02'),
    },
  ]

  for (const tx of transactions) {
    await prisma.financialTransaction.upsert({
      where: { id: tx.id },
      update: tx,
      create: tx,
    })
  }

  // --------------------------------------------------------------------------
  // 11. BUDGET REQUESTS
  // --------------------------------------------------------------------------
  console.log('  -> Seeding PM Budget Requests...')

  const budgetRequests = [
    {
      id: 'br_01',
      projectId: 'proj_01',
      requesterId: 'emp_pm_01',
      requestedAmount: new Prisma.Decimal(15000.0),
      approvedAmount: new Prisma.Decimal(15000.0),
      reason:
        'Additional compute node allocation for rendering satellite GIS tiles during heavy rural connectivity tests.',
      status: 'approved',
      feedback: 'Approved by CFO Rahid under R&D infrastructure reserve.',
      reviewedById: 'emp_cfo_01',
      requestedAt: new Date('2026-10-31'),
      reviewedAt: new Date('2026-11-01'),
    },
    {
      id: 'br_02',
      projectId: 'proj_05',
      requesterId: 'emp_pm_03',
      requestedAmount: new Prisma.Decimal(8000.0),
      reason: 'Procuring local crop pathology training images from Joydebpur Agri Institute.',
      status: 'pending',
      feedback: 'Awaiting CFO review in financial allocations queue.',
      requestedAt: new Date('2026-11-04'),
    },
  ]

  for (const br of budgetRequests) {
    await prisma.budgetRequest.upsert({
      where: { id: br.id },
      update: br,
      create: br,
    })
  }

  // --------------------------------------------------------------------------
  // 12. TASKS, CHECKLISTS, & SUBMISSIONS
  // --------------------------------------------------------------------------
  console.log(
    '  -> Seeding Tasks across Kanban columns (Todo, In Progress, In Review, Completed, Blocked)...',
  )

  const tasks = [
    {
      id: 'task_01',
      title: 'Implement 64-District GIS Map Layer component',
      description:
        'Build a canvas-accelerated interactive map visualizer for exploring historic places across all 64 districts in Unseen Bangladesh.',
      projectId: 'proj_01',
      creatorId: 'emp_pm_01',
      assigneeId: 'emp_dev_01',
      status: 'in_progress',
      priority: 'urgent',
      dueDate: new Date('2026-11-12'),
      estimatedHours: new Prisma.Decimal(16),
      loggedHours: new Prisma.Decimal(10.5),
      milestoneId: 'ms_01_3',
      tags: ['React 19', 'GIS Map', 'Canvas', 'Performance'],
    },
    {
      id: 'task_02',
      title: 'Fix offline homestay caching sync conflict',
      description:
        'Resolve local SQLite caching inconsistencies when users reconnect after traveling through remote hill tracts.',
      projectId: 'proj_01',
      creatorId: 'emp_pm_01',
      assigneeId: 'emp_dev_01',
      status: 'in_review',
      priority: 'high',
      dueDate: new Date('2026-11-10'),
      estimatedHours: new Prisma.Decimal(8),
      loggedHours: new Prisma.Decimal(8),
      milestoneId: 'ms_01_3',
      tags: ['Offline-Sync', 'Bugfix', 'Storage'],
    },
    {
      id: 'task_03',
      title: 'Client-side PDF metadata redaction worker',
      description:
        'Implement zero-knowledge in-browser metadata stripper in Ghush.com before whistleblowers upload evidence files.',
      projectId: 'proj_02',
      creatorId: 'emp_pm_01',
      assigneeId: 'emp_dev_01',
      status: 'in_progress',
      priority: 'high',
      dueDate: new Date('2026-11-14'),
      estimatedHours: new Prisma.Decimal(14),
      loggedHours: new Prisma.Decimal(6),
      milestoneId: 'ms_02_3',
      tags: ['Security', 'Cryptography', 'WASM'],
    },
    {
      id: 'task_04',
      title: 'Add automated cryptographic receipt verification badge',
      description:
        'Display SHA-256 evidence timestamp badge in Ghush.com submission acknowledgment receipt.',
      projectId: 'proj_02',
      creatorId: 'emp_pm_01',
      assigneeId: 'emp_dev_01',
      status: 'todo',
      priority: 'medium',
      dueDate: new Date('2026-11-18'),
      estimatedHours: new Prisma.Decimal(6),
      loggedHours: new Prisma.Decimal(0),
      milestoneId: 'ms_02_3',
      tags: ['UI', 'Crypto'],
    },
    {
      id: 'task_05',
      title: 'Sprint 2 Architecture Sign-Off Deliverable',
      description:
        'Finalize architectural RFC document for Unseen Bangladesh telemetry pipeline and submit for CTO approval.',
      projectId: 'proj_01',
      creatorId: 'emp_cto_01',
      assigneeId: 'emp_dev_01',
      status: 'completed',
      priority: 'urgent',
      dueDate: new Date('2026-10-28'),
      estimatedHours: new Prisma.Decimal(20),
      loggedHours: new Prisma.Decimal(20),
      milestoneId: 'ms_01_2',
      tags: ['Architecture', 'Milestone'],
    },
    {
      id: 'task_06',
      title: 'Resolve rate limiting bottleneck on SMS gateway',
      description:
        'SMS verification queue blocked by telecom provider throttling on BloodConnect BD.',
      projectId: 'proj_09',
      creatorId: 'emp_pm_05',
      assigneeId: 'emp_dev_17',
      status: 'blocked',
      priority: 'urgent',
      dueDate: new Date('2026-11-09'),
      estimatedHours: new Prisma.Decimal(12),
      loggedHours: new Prisma.Decimal(4),
      tags: ['SMS', 'ThirdParty', 'Blocked'],
    },
  ]

  for (const t of tasks) {
    await prisma.task.upsert({
      where: { id: t.id },
      update: t,
      create: t,
    })
  }

  // Checklist items for task_01
  const checklistItems = [
    {
      id: 'chk_01_1',
      taskId: 'task_01',
      text: 'Ingest GeoJSON vector polygons for 64 districts',
      completed: true,
    },
    {
      id: 'chk_01_2',
      taskId: 'task_01',
      text: 'Implement WebGL path batching for 60fps zooming',
      completed: true,
    },
    {
      id: 'chk_01_3',
      taskId: 'task_01',
      text: 'Add touch gestures for mobile tablet viewport',
      completed: false,
    },
    {
      id: 'chk_01_4',
      taskId: 'task_01',
      text: 'Connect homestay pin popovers to backend API',
      completed: false,
    },
  ]

  for (const chk of checklistItems) {
    await prisma.taskChecklistItem.upsert({
      where: { id: chk.id },
      update: chk,
      create: chk,
    })
  }

  // Submissions
  await prisma.taskSubmission.upsert({
    where: { id: 'sub_01' },
    update: {
      taskId: 'task_02',
      employeeId: 'emp_dev_01',
      prUrl: 'https://github.com/pointfex/unseen-bangladesh/pull/42',
      demoUrl: 'https://preview-42.unseenbd.pointfex.internal',
      notes:
        'Added exponential backoff and conflict resolution strategy using Last-Write-Wins on client SQLite records.',
      status: 'submitted',
    },
    create: {
      id: 'sub_01',
      taskId: 'task_02',
      employeeId: 'emp_dev_01',
      prUrl: 'https://github.com/pointfex/unseen-bangladesh/pull/42',
      demoUrl: 'https://preview-42.unseenbd.pointfex.internal',
      notes:
        'Added exponential backoff and conflict resolution strategy using Last-Write-Wins on client SQLite records.',
      status: 'submitted',
    },
  })

  // --------------------------------------------------------------------------
  // 13. PERFORMANCE RECORDS (CHRO Roster)
  // --------------------------------------------------------------------------
  console.log('  -> Seeding Performance Records...')

  const performanceRecords = [
    {
      id: 'perf_01',
      employeeId: 'emp_dev_01',
      overallScore: new Prisma.Decimal(94.5),
      deliverySpeed: new Prisma.Decimal(96.0),
      codeQuality: new Prisma.Decimal(95.0),
      reliability: new Prisma.Decimal(93.0),
      collaboration: new Prisma.Decimal(94.0),
      attendanceRate: new Prisma.Decimal(98.0),
      satisfactionIndex: new Prisma.Decimal(4.9),
      performanceTier: 'top_performer',
      evaluationNotes:
        'Fahim consistently delivers high quality frontend architecture with outstanding velocity and mentorship.',
      strengths: ['High Velocity', 'Design Systems', 'Clean Architecture', 'Peer Mentoring'],
      improvements: ['Cross-team security alignment'],
      weeklyHours: [42, 40, 44, 41],
      lastEvaluationDate: new Date('2026-11-01'),
    },
    {
      id: 'perf_02',
      employeeId: 'emp_pm_01',
      overallScore: new Prisma.Decimal(92.0),
      deliverySpeed: new Prisma.Decimal(91.0),
      codeQuality: new Prisma.Decimal(92.0),
      reliability: new Prisma.Decimal(94.0),
      collaboration: new Prisma.Decimal(95.0),
      attendanceRate: new Prisma.Decimal(97.0),
      satisfactionIndex: new Prisma.Decimal(4.8),
      performanceTier: 'top_performer',
      evaluationNotes:
        'Jihad demonstrates exceptional squad facilitation, clear sprint milestones, and transparent risk management.',
      strengths: ['Agile Leadership', 'Sprint Velocity', 'Risk Mitigation'],
      improvements: ['Budget forecasting accuracy'],
      weeklyHours: [40, 42, 40, 41],
      lastEvaluationDate: new Date('2026-11-01'),
    },
  ]

  for (const pr of performanceRecords) {
    await prisma.performanceRecord.upsert({
      where: { id: pr.id },
      update: pr,
      create: pr,
    })
  }

  // --------------------------------------------------------------------------
  // 14. REPORTS, PROPOSALS, & CONFIDENTIAL GRIEVANCES
  // --------------------------------------------------------------------------
  console.log('  -> Seeding Reports, Grievances, & Confidential Desks...')

  const reports = [
    // Project Proposal
    {
      id: 'rep_prop_01',
      authorId: 'emp_dev_01',
      teamId: 'team_01',
      projectId: 'proj_01',
      type: 'project_submission',
      category: 'Architecture Innovation',
      title: 'Offline Trail Map Tile Sync Engine for Remote Upazilas',
      description:
        'Proposing a localized ServiceWorker cache protocol to enable seamless trail browsing in areas with zero mobile data.',
      docsUrl: 'https://docs.pointfex.internal/rfc/offline-tiles-v1.pdf',
      status: 'under_review',
      feedback:
        'CTO reviewed initial architecture. Scheduling a 20-min technical feasibility sync with DevOps.',
      submittedAt: new Date('2026-10-30'),
    },
    // General Complaint
    {
      id: 'rep_cmp_01',
      authorId: 'emp_dev_02',
      teamId: 'team_01',
      type: 'complaint',
      complainTo: 'Project Manager (PM)',
      title: 'Sprint 3 Scope Creep without Deadline Adjustment',
      description:
        'Additional district validation rules added mid-sprint without extending the sprint freeze target.',
      status: 'under_investigation',
      feedback: 'Assigned to Jihad (PM). Workload rebalancing scheduled for Monday standup.',
      submittedAt: new Date('2026-11-02'),
    },
    // CONFIDENTIAL GRIEVANCE 1 (Strictly restricted to CHRO and CEO)
    {
      id: 'rep_conf_01',
      authorId: 'emp_dev_04',
      targetUserId: 'emp_dev_02',
      teamId: 'team_01',
      type: 'complaint',
      title: 'Uncredited Architectural Contribution in Retro Presentation',
      description:
        'Lead engineer claimed sole credit on the event replay pipeline during Sprint 2 retrospective without acknowledging junior contributions.',
      status: 'under_investigation',
      isConfidential: true,
      confidentialTo: 'chro',
      complainTo: 'Chief Human Resources Officer (CHRO)',
      feedback: 'CHRO Naim: Confidential mediation session scheduled with team lead.',
      mediationNotes:
        'One-on-one mediation scheduled for Thursday 2 PM. Ensured complete whistleblower confidentiality.',
      submittedAt: new Date('2026-11-05'),
    },
    // CONFIDENTIAL GRIEVANCE 2 (Strictly restricted to CHRO and CEO)
    {
      id: 'rep_conf_02',
      authorId: 'emp_dev_07',
      teamId: 'team_02',
      type: 'complaint',
      title: 'Persistent Off-Hours Weekend Messaging Expectations',
      description:
        'Frequent weekend requests demanding non-emergency PR reviews outside standard office hours, impacting team morale.',
      status: 'pending',
      isConfidential: true,
      confidentialTo: 'chro',
      complainTo: 'Chief Human Resources Officer (CHRO)',
      feedback: 'Received by CHRO confidential grievance desk. Pending initial triage.',
      mediationNotes: 'Case logged for formal leadership review during executive HR sync.',
      submittedAt: new Date('2026-11-07'),
    },
  ]

  for (const r of reports) {
    await prisma.report.upsert({
      where: { id: r.id },
      update: r,
      create: r,
    })
  }

  // --------------------------------------------------------------------------
  // 15. AUDIT LOGS
  // --------------------------------------------------------------------------
  console.log('  -> Seeding Corporate Audit Stream...')

  const auditLogs = [
    {
      id: 'act_101',
      actorId: 'emp_cto_01',
      actorName: 'Abir',
      actorEmail: 'abir.cto@pointfex.internal',
      actorRole: 'CTO',
      action: 'USER_LOGIN',
      actionCode: 'USER_LOGIN',
      severity: 'INFO',
      entityType: 'session',
      entityId: 'sess_9941a',
      entityTitle: 'Executive Session Authentication',
      description:
        'Successful multi-factor authentication from secure workstation (IP: 103.205.180.12)',
      category: 'security',
      badgeColor: 'sky',
      payload: {
        authMethod: 'FIDO2_HARDWARE_KEY',
        ipAddress: '103.205.180.12',
        workstation: 'Engineering-HQ-01',
      },
      timestamp: new Date('2026-11-08T06:30:00Z'),
    },
    {
      id: 'act_102',
      actorId: 'emp_cfo_01',
      actorName: 'Rahid',
      actorEmail: 'rahid.cfo@pointfex.internal',
      actorRole: 'CFO',
      action: 'BUDGET_DISBURSED',
      actionCode: 'CAPITAL_ALLOCATION_UPDATED',
      severity: 'INFO',
      entityType: 'project',
      entityId: 'proj_01',
      entityTitle: 'Unseen Bangladesh',
      description: 'Approved project budget increase of ৳15,000 from liquid reserves',
      category: 'finance',
      badgeColor: 'emerald',
      payload: { previousBudget: 30000, newBudget: 45000, approvedBy: 'Rahid' },
      timestamp: new Date('2026-11-01T10:00:00Z'),
    },
    {
      id: 'act_103',
      actorId: 'emp_chro_01',
      actorName: 'Naim',
      actorEmail: 'naim.chro@pointfex.internal',
      actorRole: 'CHRO',
      action: 'CONFIDENTIAL_GRIEVANCE_TRIAGED',
      actionCode: 'HR_CONFIDENTIAL_GRIEVANCE_UPDATED',
      severity: 'INFO',
      entityType: 'report',
      entityId: 'rep_conf_01',
      entityTitle: 'Whistleblower Mediation Log',
      description:
        'Privileged confidential grievance acknowledged and scheduled for private mediation',
      category: 'people',
      badgeColor: 'purple',
      payload: { triageCategory: 'Interpersonal Attribution', mediator: 'Naim' },
      timestamp: new Date('2026-11-05T14:30:00Z'),
    },
  ]

  for (const log of auditLogs) {
    await prisma.auditLog.upsert({
      where: { id: log.id },
      update: log,
      create: log,
    })
  }

  // --------------------------------------------------------------------------
  // 16. ENGINEERING: CODE QUALITY, SECURITY ALERTS, & TEST RUNS
  // --------------------------------------------------------------------------
  console.log('  -> Seeding Code Quality, Security Alerts & Test Runs...')

  // Code quality records for 12 projects
  for (let i = 1; i <= 12; i++) {
    const projId = `proj_${String(i).padStart(2, '0')}`
    await prisma.codeQualityRecord.upsert({
      where: { projectId: projId },
      update: {
        complianceScore: 92 + (i % 7),
        testCoverage: 84 + (i % 12),
        techDebtHours: 8 + i * 2,
        codeSmellsCount: 3 + (i % 5),
        bugsDetected: i === 4 ? 2 : 0,
        vulnerabilitiesCount: i === 7 ? 1 : 0,
        status: i === 4 ? 'warning' : 'passed',
      },
      create: {
        id: `cqr_${projId}`,
        projectId: projId,
        complianceScore: 92 + (i % 7),
        testCoverage: 84 + (i % 12),
        techDebtHours: 8 + i * 2,
        codeSmellsCount: 3 + (i % 5),
        bugsDetected: i === 4 ? 2 : 0,
        vulnerabilitiesCount: i === 7 ? 1 : 0,
        status: i === 4 ? 'warning' : 'passed',
      },
    })
  }

  // Security Alert
  await prisma.securityAlert.upsert({
    where: { id: 'sec_01' },
    update: {
      projectId: 'proj_07',
      title: 'Permissive JWT Algorithm Fallback in Auth Middleware',
      severity: 'critical',
      category: 'auth',
      status: 'patch_in_progress',
      assignedPmId: 'emp_pm_04',
      cveOrPackage: 'CVE-2026-38291 (Auth0 / jsonwebtoken)',
      description:
        'Permissive validation allowed fallback to "none" algorithm under malformed header inspection.',
      recommendation:
        'Strictly enforce Ed25519 signature validation and reject unsigned payloads at gateway boundary.',
    },
    create: {
      id: 'sec_01',
      projectId: 'proj_07',
      title: 'Permissive JWT Algorithm Fallback in Auth Middleware',
      severity: 'critical',
      category: 'auth',
      status: 'patch_in_progress',
      assignedPmId: 'emp_pm_04',
      cveOrPackage: 'CVE-2026-38291 (Auth0 / jsonwebtoken)',
      description:
        'Permissive validation allowed fallback to "none" algorithm under malformed header inspection.',
      recommendation:
        'Strictly enforce Ed25519 signature validation and reject unsigned payloads at gateway boundary.',
    },
  })

  // Test Run
  await prisma.testRun.upsert({
    where: { id: 'tr_01' },
    update: {
      projectId: 'proj_01',
      name: 'Unseen BD Core Regression & GIS Pipeline Suite',
      totalTests: 142,
      passed: 140,
      failed: 2,
      skipped: 0,
      duration: '4.8s',
      coveragePercent: new Prisma.Decimal(91.4),
      status: 'warning',
    },
    create: {
      id: 'tr_01',
      projectId: 'proj_01',
      name: 'Unseen BD Core Regression & GIS Pipeline Suite',
      totalTests: 142,
      passed: 140,
      failed: 2,
      skipped: 0,
      duration: '4.8s',
      coveragePercent: new Prisma.Decimal(91.4),
      status: 'warning',
    },
  })

  // --------------------------------------------------------------------------
  // 17. CONSULTANCY & GOVERNANCE
  // --------------------------------------------------------------------------
  console.log('  -> Seeding Technical Consultancy Requests & Directives...')

  await prisma.consultancyRequest.upsert({
    where: { id: 'cst_01' },
    update: {
      title: 'Lock-Free GeoJSON Path Batching Advisory',
      requesterId: 'emp_dev_01',
      teamId: 'team_01',
      projectId: 'proj_01',
      category: 'High-Throughput GIS Systems',
      description:
        'Need advisory review on lock-free canvas buffer memory allocation in V8 to avoid GC pauses during multi-district zooming.',
      urgency: 'high',
      status: 'assigned',
      assignedConsultantId: 'emp_cto_01',
      assignedConsultantName: 'Abir (CTO Advisory)',
      estimatedHours: new Prisma.Decimal(6),
      feeBDT: new Prisma.Decimal(8000.0),
      ctoNotes:
        'Scheduled architectural deep dive. Recommending ArrayBuffer backed circular ring with atomic indexes.',
    },
    create: {
      id: 'cst_01',
      title: 'Lock-Free GeoJSON Path Batching Advisory',
      requesterId: 'emp_dev_01',
      teamId: 'team_01',
      projectId: 'proj_01',
      category: 'High-Throughput GIS Systems',
      description:
        'Need advisory review on lock-free canvas buffer memory allocation in V8 to avoid GC pauses during multi-district zooming.',
      urgency: 'high',
      status: 'assigned',
      assignedConsultantId: 'emp_cto_01',
      assignedConsultantName: 'Abir (CTO Advisory)',
      estimatedHours: new Prisma.Decimal(6),
      feeBDT: new Prisma.Decimal(8000.0),
      ctoNotes:
        'Scheduled architectural deep dive. Recommending ArrayBuffer backed circular ring with atomic indexes.',
    },
  })

  await prisma.executiveDirective.upsert({
    where: { id: 'dir_01' },
    update: {
      title: 'Mandatory SOC2 Type II Pre-Audit Freeze across all Squad Repositories',
      description:
        'All 6 squad PMs must audit pull request signature enforcement and verify zero open critical alerts prior to Sprint 4 freeze.',
      assigneeRole: 'pm',
      priority: 'urgent',
      tags: ['Executive Directive', 'Security', 'Compliance'],
      issuedById: 'emp_ceo_01',
    },
    create: {
      id: 'dir_01',
      title: 'Mandatory SOC2 Type II Pre-Audit Freeze across all Squad Repositories',
      description:
        'All 6 squad PMs must audit pull request signature enforcement and verify zero open critical alerts prior to Sprint 4 freeze.',
      assigneeRole: 'pm',
      priority: 'urgent',
      tags: ['Executive Directive', 'Security', 'Compliance'],
      issuedById: 'emp_ceo_01',
    },
  })

  await prisma.executiveDecision.upsert({
    where: { id: 'dec_01' },
    update: {
      actionType: 'squad_budget_reallocation_ratification',
      entityId: 'proj_01',
      notes: 'CEO officially ratified ৳15,000 contingency allocation for Unseen Bangladesh.',
      ratifiedById: 'emp_ceo_01',
    },
    create: {
      id: 'dec_01',
      actionType: 'squad_budget_reallocation_ratification',
      entityId: 'proj_01',
      notes: 'CEO officially ratified ৳15,000 contingency allocation for Unseen Bangladesh.',
      ratifiedById: 'emp_ceo_01',
    },
  })

  await prisma.announcement.upsert({
    where: { id: 'ann_01' },
    update: {
      title: 'Sprint 3 Mid-Sprint Demo & Code Freeze Schedule',
      content:
        'All 6 squads (Team Alpha through Team Foxtrot) are scheduled for Sprint 3 milestone reviews this Thursday at 3:00 PM BST.',
      authorId: 'emp_pm_01',
      category: 'pm',
      priority: 'urgent',
      pinned: true,
    },
    create: {
      id: 'ann_01',
      title: 'Sprint 3 Mid-Sprint Demo & Code Freeze Schedule',
      content:
        'All 6 squads (Team Alpha through Team Foxtrot) are scheduled for Sprint 3 milestone reviews this Thursday at 3:00 PM BST.',
      authorId: 'emp_pm_01',
      category: 'pm',
      priority: 'urgent',
      pinned: true,
    },
  })

  await prisma.announcement.upsert({
    where: { id: 'ann_02' },
    update: {
      title: 'Company All-Hands: Q4 Roadmap & BDT Milestone Disbursements',
      content:
        'CEO Noor and CFO Rahid will review Q4 treasury allocations and client revenue shares.',
      authorId: 'emp_ceo_01',
      category: 'company',
      priority: 'normal',
      pinned: false,
    },
    create: {
      id: 'ann_02',
      title: 'Company All-Hands: Q4 Roadmap & BDT Milestone Disbursements',
      content:
        'CEO Noor and CFO Rahid will review Q4 treasury allocations and client revenue shares.',
      authorId: 'emp_ceo_01',
      category: 'company',
      priority: 'normal',
      pinned: false,
    },
  })

  await prisma.notification.upsert({
    where: { id: 'notif_01' },
    update: {
      userId: 'emp_dev_01',
      title: 'Task Assigned: Unseen BD GIS Engine',
      message: 'PM Jihad assigned Sprint 3 milestone tasks to your board.',
      type: 'comment',
      read: false,
      entityType: 'task',
      entityId: 'task_01',
    },
    create: {
      id: 'notif_01',
      userId: 'emp_dev_01',
      title: 'Task Assigned: Unseen BD GIS Engine',
      message: 'PM Jihad assigned Sprint 3 milestone tasks to your board.',
      type: 'comment',
      read: false,
      entityType: 'task',
      entityId: 'task_01',
    },
  })

  await prisma.notification.upsert({
    where: { id: 'notif_02' },
    update: {
      userId: 'emp_dev_01',
      title: 'Wallet Credit: ৳2,000.00 Bonus',
      message: 'Sprint 2 Architecture Excellence bonus was deposited to your wallet.',
      type: 'financial',
      read: false,
      entityType: 'wallet',
      entityId: 'tx_bonus_01',
    },
    create: {
      id: 'notif_02',
      userId: 'emp_dev_01',
      title: 'Wallet Credit: ৳2,000.00 Bonus',
      message: 'Sprint 2 Architecture Excellence bonus was deposited to your wallet.',
      type: 'financial',
      read: false,
      entityType: 'wallet',
      entityId: 'tx_bonus_01',
    },
  })

  await seedRbac(prisma)

  console.log('✅ Pointfex ERP Seed completed successfully! Idempotent and ready for verification.')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
