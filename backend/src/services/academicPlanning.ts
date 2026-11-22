import { differenceInCalendarDays, formatISO, startOfDay } from 'date-fns';
import { AcademicContext, AcademicNeed, Book, Course, Topic } from '../types';

const norm = (s: string) => s.trim().toLowerCase();

/** A need still matters until the end of its needed-until day. */
export function isActiveNeed(need: AcademicNeed, at: Date): boolean {
  return startOfDay(new Date(need.neededUntil)) >= startOfDay(at);
}

/**
 * How strongly an upcoming assessment should influence decisions. Imminent
 * assessments count fully; ones far away count less; past needs count zero.
 */
export function needUrgencyWeight(need: AcademicNeed, at: Date): number {
  if (!isActiveNeed(need, at)) return 0;
  const days = differenceInCalendarDays(new Date(need.assessmentDate), at);
  if (days <= 7) return 1;
  if (days <= 21) return 0.7;
  return 0.4;
}

/** Does this need refer to material covered by the book (by topic or by course)? */
export function needMatchesBook(
  need: AcademicNeed,
  book: Book,
  topicLookup: Map<string, Topic>,
  courseLookup: Map<string, Course>,
): boolean {
  const needTopic = norm(need.topic);
  const needCourse = norm(need.course);

  const topicHit = book.topicIds.some((id) => {
    const name = topicLookup.get(id)?.name;
    if (!name) return false;
    const t = norm(name);
    return t === needTopic || t.includes(needTopic) || needTopic.includes(t);
  });
  if (topicHit) return true;

  return book.courseIds.some((id) => {
    const course = courseLookup.get(id);
    if (!course) return false;
    return norm(course.code) === needCourse || norm(course.name) === needCourse;
  });
}

/**
 * Picks the active need that constrains this loan the most (the one needed
 * latest) and describes how it relates to the current and projected due dates.
 */
export function buildAcademicContext(params: {
  book: Book;
  needs: AcademicNeed[];
  topicLookup: Map<string, Topic>;
  courseLookup: Map<string, Course>;
  dueAt: Date;
  projectedDueAt?: Date | null;
  at: Date;
}): AcademicContext | null {
  const { book, needs, topicLookup, courseLookup, dueAt, projectedDueAt, at } = params;
  const relevant = needs
    .filter((n) => isActiveNeed(n, at) && needMatchesBook(n, book, topicLookup, courseLookup))
    .sort((a, b) => new Date(b.neededUntil).getTime() - new Date(a.neededUntil).getTime());

  const need = relevant[0];
  if (!need) return null;

  const neededUntil = new Date(need.neededUntil);
  const neededBeyondDue = startOfDay(neededUntil) > startOfDay(dueAt);

  return {
    need_id: need.id,
    course: need.course,
    topic: need.topic,
    assessment_type: need.assessmentType,
    assessment_date: formatISO(new Date(need.assessmentDate)),
    needed_until: formatISO(neededUntil),
    days_until_assessment: differenceInCalendarDays(new Date(need.assessmentDate), at),
    needed_beyond_due: neededBeyondDue,
    ...(projectedDueAt
      ? { renewal_covers_need: startOfDay(projectedDueAt) >= startOfDay(neededUntil) }
      : {}),
  };
}
