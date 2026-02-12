// get the ninja-keys element
const ninja = document.querySelector('ninja-keys');

// add the home and posts menu items
ninja.data = [{
    id: "nav-about",
    title: "about",
    section: "Navigation",
    handler: () => {
      window.location.href = "/";
    },
  },{id: "nav-publications",
          title: "publications",
          description: "Publications generated from the CV bibliography.",
          section: "Navigation",
          handler: () => {
            window.location.href = "/publications/";
          },
        },{id: "nav-projects",
          title: "projects",
          description: "Research projects and funded initiatives.",
          section: "Navigation",
          handler: () => {
            window.location.href = "/projects/";
          },
        },{id: "nav-books",
          title: "books",
          description: "",
          section: "Navigation",
          handler: () => {
            window.location.href = "/books/";
          },
        },{id: "nav-cv",
          title: "CV",
          description: "Full curriculum vitae with appointments, projects, teaching, and service.",
          section: "Navigation",
          handler: () => {
            window.location.href = "/cv/";
          },
        },{id: "nav-teaching",
          title: "teaching",
          description: "Courses taught, supervision, and academic teaching activities.",
          section: "Navigation",
          handler: () => {
            window.location.href = "/teaching/";
          },
        },{id: "books-sonic-interactions-in-virtual-environments",
          title: 'Sonic Interactions in Virtual Environments',
          description: "",
          section: "Books",handler: () => {
              window.location.href = "/books/sonic-interactions-in-virtual-environments/";
            },},{id: "projects-sonicom",
          title: 'SONICOM',
          description: "H2020 FET-Proactive project on auditory-based social interaction in AR/VR.",
          section: "Projects",handler: () => {
              window.location.href = "/projects/1_project/";
            },},{id: "projects-s-twin",
          title: 'S-TWIN',
          description: "Auditory digital twin of a cochlear implant (PRIN 2022).",
          section: "Projects",handler: () => {
              window.location.href = "/projects/2_project/";
            },},{id: "projects-lap-challenge-2024",
          title: 'LAP Challenge 2024',
          description: "Listener Acoustic Personalisation Challenge sponsored by IEEE SPS.",
          section: "Projects",handler: () => {
              window.location.href = "/projects/3_project/";
            },},{id: "projects-padva",
          title: 'PADVA',
          description: "Personal Auditory Displays for Virtual Acoustics (University of Padua).",
          section: "Projects",handler: () => {
              window.location.href = "/projects/5_project/";
            },},{id: "teachings-digital-humanities-lab",
          title: 'Digital Humanities Lab',
          description: "Adjunct Professor (6 ECTS) in the BA in Humanities, University of Udine.",
          section: "Teachings",handler: () => {
              window.location.href = "/teachings/digital-humanities-lab/";
            },},{id: "teachings-fundamentals-of-computer-science",
          title: 'Fundamentals of Computer Science',
          description: "Course leader (6 ECTS, 72 hours) in the BSc in Management Engineering, University of Padua. Active since 2022.",
          section: "Teachings",handler: () => {
              window.location.href = "/teachings/fundamentals-computer-science/";
            },},{id: "teachings-immersive-technologies-and-experiences-for-smart-industry",
          title: 'Immersive Technologies and Experiences for Smart Industry',
          description: "PhD course (1 ECTS) for the Doctoral School in Mechatronics Engineering and Product Innovation, University of Padua.",
          section: "Teachings",handler: () => {
              window.location.href = "/teachings/immersive-technologies-smart-industry/";
            },},{id: "teachings-industrial-applications-of-computer-vision",
          title: 'Industrial Applications of Computer Vision',
          description: "Course leader (6 ECTS, 72 hours) in the MSc in Mechatronics Engineering, University of Padua. Active since 2025.",
          section: "Teachings",handler: () => {
              window.location.href = "/teachings/industrial-applications-computer-vision/";
            },},{id: "teachings-industrial-computer-architectures-and-networks",
          title: 'Industrial Computer Architectures and Networks',
          description: "Lecturer (24 hours) at ITS Meccatronico Veneto, Vicenza.",
          section: "Teachings",handler: () => {
              window.location.href = "/teachings/industrial-computer-architectures/";
            },},{id: "teachings-industrial-controllers-and-communication-networks",
          title: 'Industrial Controllers and Communication Networks',
          description: "Course leader (6 ECTS, 48 hours) in the BSc in Mechatronics Engineering, University of Padua.",
          section: "Teachings",handler: () => {
              window.location.href = "/teachings/industrial-controllers-and-networks/";
            },},{id: "teachings-virtual-augmented-and-mixed-realities",
          title: 'Virtual, Augmented and Mixed Realities',
          description: "PhD course (5 ECTS) in Media Technologies, Aalborg University Copenhagen.",
          section: "Teachings",handler: () => {
              window.location.href = "/teachings/virtual-augmented-mixed-realities/";
            },},{
        id: 'social-email',
        title: 'email',
        section: 'Socials',
        handler: () => {
          window.open("mailto:%6D%69%63%68%65%6C%65.%67%65%72%6F%6E%61%7A%7A%6F@%75%6E%69%70%64.%69%74", "_blank");
        },
      },{
        id: 'social-linkedin',
        title: 'LinkedIn',
        section: 'Socials',
        handler: () => {
          window.open("https://www.linkedin.com/in/michele-geronazzo", "_blank");
        },
      },{
        id: 'social-orcid',
        title: 'ORCID',
        section: 'Socials',
        handler: () => {
          window.open("https://orcid.org/0000-0002-0621-2704", "_blank");
        },
      },{
        id: 'social-scholar',
        title: 'Google Scholar',
        section: 'Socials',
        handler: () => {
          window.open("https://scholar.google.com/citations?user=FZi4M7kAAAAJ", "_blank");
        },
      },{
        id: 'social-rss',
        title: 'RSS Feed',
        section: 'Socials',
        handler: () => {
          window.open("/feed.xml", "_blank");
        },
      },{
      id: 'light-theme',
      title: 'Change theme to light',
      description: 'Change the theme of the site to Light',
      section: 'Theme',
      handler: () => {
        setThemeSetting("light");
      },
    },
    {
      id: 'dark-theme',
      title: 'Change theme to dark',
      description: 'Change the theme of the site to Dark',
      section: 'Theme',
      handler: () => {
        setThemeSetting("dark");
      },
    },
    {
      id: 'system-theme',
      title: 'Use system default theme',
      description: 'Change the theme of the site to System Default',
      section: 'Theme',
      handler: () => {
        setThemeSetting("system");
      },
    },];
