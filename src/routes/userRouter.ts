import { multerUpload } from '@/common/config';
import { changePassword, deleteAccount, editUserProfile, restoreAccount, updateProfilePhoto } from '@/controllers';
import { protect } from '@/middlewares';
import express from 'express';
const router = express.Router();

router.post('/restore', restoreAccount);

router.use(protect); // Protect all routes after this middleware
router.post('/update-profile', editUserProfile);
router.post('/profile-photo', multerUpload.single('photo'), updateProfilePhoto);
router.delete('/delete-account', deleteAccount);
router.post('/change-password', changePassword);
export { router as userRouter };
