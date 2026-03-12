export interface ContactEntry {
  name: string;
  role?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface ContactCategory {
  id: string;
  label: string;
  icon: string; // lucide icon name
  accentColor: string; // tailwind border color class
  contacts: ContactEntry[];
}

export interface SchoolContacts {
  school_id: string;
  school_name: string;
  categories: ContactCategory[];
}

export const contactsBySchool: SchoolContacts[] = [
  {
    school_id: "bayside-smfcsd",
    school_name: "Bayside Academy",
    categories: [
      {
        id: "urgent",
        label: "Urgent / School Office",
        icon: "AlertTriangle",
        accentColor: "border-l-red-400",
        contacts: [
          {
            name: "Main Office",
            role: "Bayside Academy",
            phone: "(650) 312-7660",
            address: "2025 Kehoe Ave, San Mateo, CA 94403",
          },
          {
            name: "Attendance Line",
            role: "Bayside Academy",
            phone: "(650) 312-7660 Ext 3",
          },
        ],
      },
      {
        id: "health",
        label: "Health & Wellness",
        icon: "Heart",
        accentColor: "border-l-blue-400",
        contacts: [
          {
            name: "Suzi Riley",
            role: "District Wellness Coordinator",
            phone: "(650) 312-7248",
            email: "sriley@smfcsd.net",
          },
          {
            name: "Nicole Monozon, RN",
            role: "District Nurse",
            phone: "(650) 350-3203 x3047",
            email: "nmonozon@smfc.k12.ca.us",
          },
          {
            name: "Natalie Mainini, RN",
            role: "District Nurse",
            phone: "(650) 477-0130 x7295",
            email: "nmainini@smfc.k12.ca.us",
          },
          {
            name: "Christina Hirsch, LVN",
            role: "District Nurse",
            phone: "(650) 303-4675 x7297",
            email: "chirsch@smfc.k12.ca.us",
          },
          {
            name: "Marilyn Ponce De Leon, RN",
            role: "District Nurse",
          },
          {
            name: "Lesley Neri",
            role: "Spanish-Speaking Support",
            phone: "(650) 312-7296",
            email: "lneri@smfcsd.net",
          },
        ],
      },
      {
        id: "nutrition",
        label: "Nutrition",
        icon: "Apple",
        accentColor: "border-l-green-400",
        contacts: [
          {
            name: "Child Nutrition Services",
            phone: "(650) 312-1968",
          },
        ],
      },
      {
        id: "district",
        label: "District",
        icon: "Building",
        accentColor: "border-l-purple-400",
        contacts: [
          {
            name: "SMFCSD Administrative Office",
            role: "District Office",
            phone: "(650) 312-7700",
            address: "1170 Chess Drive, Foster City, CA 94404",
          },
          {
            name: "Student Services",
            role: "District Services",
            phone: "(650) 312-7341",
            email: "larmstrong@smfc.k12.ca.us",
          },
        ],
      },
    ],
  },
  {
    school_id: "baywood-smfcsd",
    school_name: "Baywood Elementary",
    categories: [
      {
        id: "urgent",
        label: "Urgent / School Office",
        icon: "AlertTriangle",
        accentColor: "border-l-red-400",
        contacts: [
          {
            name: "Main Office",
            role: "Baywood Elementary",
            phone: "(650) 312-7511",
            address: "600 Alameda de Las Pulgas, San Mateo, CA 94402",
          },
          {
            name: "Attendance Line",
            role: "Baywood Elementary",
            phone: "(650) 312-7512 Ext 3",
          },
        ],
      },
      {
        id: "health",
        label: "Health & Wellness",
        icon: "Heart",
        accentColor: "border-l-blue-400",
        contacts: [
          {
            name: "Suzi Riley",
            role: "District Wellness Coordinator",
            phone: "(650) 312-7248",
            email: "sriley@smfcsd.net",
          },
          {
            name: "Nicole Monozon, RN",
            role: "District Nurse",
            phone: "(650) 350-3203 x3047",
            email: "nmonozon@smfc.k12.ca.us",
          },
          {
            name: "Natalie Mainini, RN",
            role: "District Nurse",
            phone: "(650) 477-0130 x7295",
            email: "nmainini@smfc.k12.ca.us",
          },
          {
            name: "Christina Hirsch, LVN",
            role: "District Nurse",
            phone: "(650) 303-4675 x7297",
            email: "chirsch@smfc.k12.ca.us",
          },
          {
            name: "Marilyn Ponce De Leon, RN",
            role: "District Nurse",
          },
          {
            name: "Lesley Neri",
            role: "Spanish-Speaking Support",
            phone: "(650) 312-7296",
            email: "lneri@smfcsd.net",
          },
        ],
      },
      {
        id: "nutrition",
        label: "Nutrition",
        icon: "Apple",
        accentColor: "border-l-green-400",
        contacts: [
          {
            name: "Child Nutrition Services",
            phone: "(650) 312-1968",
          },
        ],
      },
      {
        id: "district",
        label: "District",
        icon: "Building",
        accentColor: "border-l-purple-400",
        contacts: [
          {
            name: "SMFCSD Administrative Office",
            role: "District Office",
            phone: "(650) 312-7700",
            address: "1170 Chess Drive, Foster City, CA 94404",
          },
          {
            name: "Student Services",
            role: "District Services",
            phone: "(650) 312-7341",
            email: "larmstrong@smfc.k12.ca.us",
          },
        ],
      },
    ],
  },
];
