// Parse DD/MM/YYYY or DD-MM-YYYY format to Date
export const parseDate = (dateStr: string): Date | null => {
  const patterns = [
    /^(\d{2})\/(\d{2})\/(\d{4})$/, // DD/MM/YYYY
    /^(\d{2})-(\d{2})-(\d{4})$/, // DD-MM-YYYY
    /^(\d{2})\.(\d{2})\.(\d{4})$/, // DD.MM.YYYY
  ];

  for (const pattern of patterns) {
    const match = dateStr.match(pattern);
    if (match) {
      const [, day, month, year] = match;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  }

  return null;
};

// Format Date to DD/MM/YYYY
export const formatDate = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

// Calculate years of seniority between two dates
export const calculateSeniority = (startDate: Date, endDate: Date): number => {
  const diffTime = endDate.getTime() - startDate.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  return diffDays / 365.25;
};

// Add days to a date
export const addDaysToDate = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

// Add weeks to a date
export const addWeeksToDate = (date: Date, weeks: number): Date => {
  return addDaysToDate(date, weeks * 7);
};

// Check if a date is before 01/01/2014
export const isBeforeThreshold = (date: Date): boolean => {
  const threshold = new Date(2014, 0, 1);
  return date < threshold;
};

// Validate date input
export const isValidDate = (dateStr: string): boolean => {
  return parseDate(dateStr) !== null;
};
