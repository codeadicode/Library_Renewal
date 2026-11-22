import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { IAcademicNeedRepository } from '../repositories/interfaces';
import { startOfDay } from 'date-fns';
import { academicNeedPatchSchema, academicNeedSchema } from '../validators';
import { HttpError } from '../lib/errors';
import { now } from '../lib/clock';

function assertNeedDates(assessmentDate: Date, neededUntil: Date) {
  if (startOfDay(neededUntil) < startOfDay(now())) {
    throw new HttpError(400, 'The "needed until" date is already in the past.', 'VALIDATION_ERROR');
  }
  if (startOfDay(neededUntil) < startOfDay(assessmentDate)) {
    throw new HttpError(400, 'The "needed until" date cannot be before the assessment date.', 'VALIDATION_ERROR');
  }
}

export class AcademicNeedController {
  constructor(private needRepo: IAcademicNeedRepository) {}

  public getNeeds = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const needs = await this.needRepo.findByUserId(userId);
      res.status(200).json(needs);
    } catch (err) {
      next(err);
    }
  };

  public createNeed = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const data = academicNeedSchema.parse(req.body);
      assertNeedDates(new Date(data.assessmentDate), new Date(data.neededUntil));
      const created = await this.needRepo.create({
        userId,
        course: data.course,
        topic: data.topic,
        assessmentType: data.assessmentType,
        assessmentDate: new Date(data.assessmentDate),
        neededUntil: new Date(data.neededUntil),
      });
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  };

  public updateNeed = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const id = req.params.id;
      const patch = academicNeedPatchSchema.parse(req.body);
      if (patch.assessmentDate || patch.neededUntil) {
        const current = (await this.needRepo.findByUserId(userId)).find((n) => n.id === id);
        if (!current) {
          res.status(404).json({ error: 'NOT_FOUND', message: 'Academic requirement not found' });
          return;
        }
        assertNeedDates(
          patch.assessmentDate ? new Date(patch.assessmentDate) : new Date(current.assessmentDate),
          patch.neededUntil ? new Date(patch.neededUntil) : new Date(current.neededUntil),
        );
      }
      const updated = await this.needRepo.update(id, userId, {
        ...(patch.course && { course: patch.course }),
        ...(patch.topic && { topic: patch.topic }),
        ...(patch.assessmentType && { assessmentType: patch.assessmentType }),
        ...(patch.assessmentDate && { assessmentDate: new Date(patch.assessmentDate) }),
        ...(patch.neededUntil && { neededUntil: new Date(patch.neededUntil) }),
      });

      if (!updated) {
        res.status(404).json({ error: 'NOT_FOUND', message: 'Academic requirement not found' });
        return;
      }
      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  };

  public deleteNeed = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const id = req.params.id;
      const deleted = await this.needRepo.delete(id, userId);
      if (!deleted) {
        res.status(404).json({ error: 'NOT_FOUND', message: 'Academic requirement not found' });
        return;
      }
      res.status(200).json({ success: true, message: 'Academic requirement removed' });
    } catch (err) {
      next(err);
    }
  };
}

