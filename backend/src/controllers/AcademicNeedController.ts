import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { IAcademicNeedRepository } from '../repositories/interfaces';
import { academicNeedPatchSchema, academicNeedSchema } from '../validators';

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

