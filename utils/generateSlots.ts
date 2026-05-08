import dayjs from "dayjs";
export const generateSlots = (
    startingTime: string = "09:00",
    endTime: string = "17:00",
    slotDuration: number = 15
) => {
    const slots:string[]=[]

  let start = dayjs(`2026-01-01 ${startingTime}`);
  const end = dayjs(`2026-01-01 ${endTime}`);
  while(start.isBefore(end)){
    slots.push(start.format("HH:mm"))
    start = start.add(slotDuration, "minutes")
  }
  return slots
}