import { useCallback, useEffect, useState } from "react";

export interface CourseRow {
  name: string;
  norm: string;
  rounds18: number;
  rating: number;
  slope: number;
  par: number;
  estimated: boolean;
}

export interface DiffRow {
  date: string;
  course: string;
  score: number;
  rating: number;
  slope: number;
  differential: number;
  estimated: boolean;
  holeCount: number; // holes played (9 or 18)
}

export interface HandicapData {
  index: number | null;
  roundsUsed: number;
  rounds18: number; // count of 18-hole rounds used
  rounds9: number;  // count of 9-hole rounds used
  recent20: DiffRow[];
  trend: { date: string; index: number }[];
  estimatedCourses: string[];
  courses: CourseRow[];
}

export function useHandicap(include9: boolean = true) {
  const [data, setData] = useState<HandicapData | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    fetch(`/api/handicap?include9=${include9 ? 1 : 0}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d?.error) setData(d as HandicapData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [include9]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, reload };
}
