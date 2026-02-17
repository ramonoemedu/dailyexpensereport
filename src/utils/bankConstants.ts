export const BANKS = [
  { id: "chip-mong", name: "Chip Mong Bank" },
  { id: "cimb", name: "CIMB Bank" },
  { id: "aba", name: "ABA Bank" },
  { id: "acleda", name: "ACLEDA Bank" },
];

export const getBankName = (id: string) => {
  return BANKS.find(b => b.id === id)?.name || id;
};
