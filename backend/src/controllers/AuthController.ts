import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { AuthService } from '../services/AuthService';
import { loginSchema, registerSchema, preferenceSchema, profileSchema } from '../validators';

export class AuthController {
  constructor(private authService: AuthService) {}

  public register = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = registerSchema.parse(req.body);
      const result = await this.authService.register(validated);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };

  public login = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = loginSchema.parse(req.body);
      const result = await this.authService.login(validated.identifier, validated.password);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  public getMe = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const user = await this.authService.getProfile(userId);
      res.status(200).json(user);
    } catch (err) {
      next(err);
    }
  };

  public updatePreferences = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { notificationPreference } = preferenceSchema.parse(req.body);
      const updated = await this.authService.updatePreferences(userId, notificationPreference);
      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  };

  public updateProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const patch = profileSchema.parse(req.body);
      const updated = await this.authService.updateProfile(userId, patch);
      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  };
}
