// Mocked "saved finds" for the Forage Finds screen.
//
// dev-note: identification is now real (see api.ts → POST /forage/identify).
// Finds persistence isn't built yet — swap this for a reactive WatermelonDB
// query once a Find model + save flow land.
export type Find = {
  id: string;
  name: string;
  latin: string;
  location: string;
  date: string;
  status: "edible" | "caution" | "unconfirmed";
};

export const MOCK_FINDS: Find[] = [
  {
    id: "1",
    name: "Salmonberry",
    latin: "Rubus spectabilis",
    location: "Rattlesnake Ledge",
    date: "Jun 18",
    status: "edible",
  },
  {
    id: "2",
    name: "Stinging nettle",
    latin: "Urtica dioica",
    location: "Tiger Mtn",
    date: "Jun 11",
    status: "caution",
  },
  {
    id: "3",
    name: "Red elderberry",
    latin: "Sambucus racemosa",
    location: "Snoqualmie Falls",
    date: "Jun 4",
    status: "caution",
  },
  {
    id: "4",
    name: "Salal",
    latin: "Gaultheria shallon",
    location: "Discovery Park",
    date: "May 28",
    status: "edible",
  },
  {
    id: "5",
    name: "Unknown berry",
    latin: "Not confirmed",
    location: "Cougar Mtn",
    date: "May 20",
    status: "unconfirmed",
  },
];
