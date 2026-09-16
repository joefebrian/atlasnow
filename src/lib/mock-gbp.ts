/** Demo Google Business Profile–shaped data for polished UI previews (not live Google yet). */

export type ReviewRow = {
  id: string;
  updatedAt: string;
  createdAt: string;
  name: string;
  review: string;
  rating: number;
  replied: boolean;
  location: string;
};

export type PostRow = {
  id: string;
  date: string;
  summary: string;
  postType: string;
  status: "Live" | "Processing" | "Rejected" | "Expired";
  thumb: string;
  location: string;
};

export const MOCK_REVIEWS: ReviewRow[] = [
  {
    id: "1",
    updatedAt: "Jul 30, 2025 12:08 AM",
    createdAt: "Jul 30, 2025 12:08 AM",
    name: "Frederick Larson",
    review: "Would definitely go again",
    rating: 5,
    replied: true,
    location: "Menteng",
  },
  {
    id: "2",
    updatedAt: "Jul 29, 2025 12:08 AM",
    createdAt: "Jul 29, 2025 12:08 AM",
    name: "Brayden Mayer",
    review: "Amazing!",
    rating: 5,
    replied: false,
    location: "Alam Sutera",
  },
  {
    id: "3",
    updatedAt: "Jul 28, 2025 12:08 AM",
    createdAt: "Jul 28, 2025 12:08 AM",
    name: "Kindra Gaskins",
    review: "Great spot for chilling out",
    rating: 5,
    replied: true,
    location: "Menteng",
  },
  {
    id: "4",
    updatedAt: "Jul 27, 2025 12:08 AM",
    createdAt: "Jul 27, 2025 12:08 AM",
    name: "Rupert Smyth",
    review: "No go try it",
    rating: 4,
    replied: false,
    location: "BSD",
  },
  {
    id: "5",
    updatedAt: "Jul 26, 2025 9:12 AM",
    createdAt: "Jul 26, 2025 9:12 AM",
    name: "Alya Putri",
    review: "Waiting time too long on weekend",
    rating: 2,
    replied: false,
    location: "Menteng",
  },
  {
    id: "6",
    updatedAt: "Jul 25, 2025 4:40 PM",
    createdAt: "Jul 25, 2025 4:40 PM",
    name: "James Ong",
    review: "Staff was friendly, gelato perfect",
    rating: 5,
    replied: true,
    location: "PIK",
  },
];

export const MOCK_POSTS: PostRow[] = [
  {
    id: "p1",
    date: "Apr 30, 2025",
    summary: "Weekend promo gelato duo — limited stock per outlet",
    postType: "Offer Post",
    status: "Live",
    thumb: "🍨",
    location: "Menteng",
  },
  {
    id: "p2",
    date: "Apr 29, 2025",
    summary: "New seasonal flavor launch this Friday",
    postType: "Standard Post",
    status: "Live",
    thumb: "🌿",
    location: "HQ",
  },
  {
    id: "p3",
    date: "Apr 27, 2025",
    summary: "Book your birthday party package",
    postType: "Event Post",
    status: "Processing",
    thumb: "🎂",
    location: "Alam Sutera",
  },
  {
    id: "p4",
    date: "Apr 25, 2025",
    summary: "Learn more about our new loyalty card",
    postType: "Standard Post",
    status: "Rejected",
    thumb: "🪪",
    location: "BSD",
  },
  {
    id: "p5",
    date: "Apr 22, 2025",
    summary: "Store hours update for Lebaran week",
    postType: "Alert Post",
    status: "Expired",
    thumb: "🕐",
    location: "PIK",
  },
];

/** Hourly series for bar/line charts (demo) */
export const HOURLY = [
  { t: "06:00", impressions: 4, interactions: 12, calls: 2, directions: 8, website: 1 },
  { t: "08:00", impressions: 9, interactions: 28, calls: 5, directions: 18, website: 3 },
  { t: "10:00", impressions: 14, interactions: 45, calls: 9, directions: 31, website: 6 },
  { t: "12:00", impressions: 18, interactions: 72, calls: 14, directions: 48, website: 11 },
  { t: "14:00", impressions: 16, interactions: 61, calls: 11, directions: 40, website: 9 },
  { t: "16:00", impressions: 20, interactions: 88, calls: 16, directions: 55, website: 12 },
  { t: "18:00", impressions: 15, interactions: 70, calls: 12, directions: 44, website: 8 },
];

export const PERF_SUMMARY = {
  platformDevice: { desktop: 96, mobile: 98, tablet: 27, voice: 0 },
  searchVsMaps: { maps: 80, search: 72 },
  impressions: 327,
  interactions: 1119,
  avgRating: 4.65,
  reviews: 508,
  calls: 278,
  directions: 919,
  websiteClicks: 99,
  messages: 296,
  bookings: 273,
  foodOrders: 128,
};
