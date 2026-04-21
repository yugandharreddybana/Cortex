"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@cortex/ui";
import { useAuthStore } from "@/store/authStore";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

const ease = [0.20, 0.90, 0.30, 1.00] as const;

const profileSchema = z.object({
  fullName: z.string().min(1, "Full name is required").max(100),
  email:    z.email("Invalid email address"),
});
type ProfileValues = z.infer<typeof profileSchema>;

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[0-9]/, "Must contain at least one number")
    .regex(/[^a-zA-Z0-9]/, "Must contain at least one special character"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});
type PasswordValues = z.infer<typeof passwordSchema>;

import { SettingSkeleton } from "@/components/dashboard/SettingSkeleton";

export default function ProfilePage() {
  const user           = useAuthStore((s) => s.user);
  const isLoading      = useAuthStore((s) => s.isLoading);
  const hasFetched     = useAuthStore((s) => s.hasFetched);
  const updateUser     = useAuthStore((s) => s.updateUser);
  const changePassword = useAuthStore((s) => s.changePassword);

  const [editing, setEditing]         = React.useState(false);
  const [avatarPreview, setAvatarPreview] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Profile form
  const {
    register: regProfile,
    handleSubmit: handleProfile,
    reset: resetProfile,
    formState: { errors: profileErrors, isSubmitting: profileSaving },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: "", email: "" },
  });

  // Password form
  const {
    register: regPwd,
    handleSubmit: handlePwd,
    reset: resetPwd,
    formState: { errors: pwdErrors, isSubmitting: pwdSaving },
  } = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  // Sync form with user data
  React.useEffect(() => {
    if (user) {
      resetProfile({ fullName: user.fullName || "", email: user.email || "" });
      setAvatarPreview(user.avatarUrl || null);
    }
  }, [user, resetProfile]);

  const displayName = user?.fullName || user?.email?.split("@")[0] || "User";
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function onProfileSave(values: ProfileValues) {
    const ok = await updateUser({
      fullName: values.fullName.trim(),
      email: values.email,
      avatarUrl: avatarPreview ?? undefined,
    });
    if (ok) {
      toast.success("Profile updated", {
        description: "Your personal information has been successfully synchronized.",
      });
      setEditing(false);
    } else {
      toast.error("Update failed", {
        description: "We couldn't save your profile changes. Please try again.",
      });
    }
  }

  function handleCancel() {
    if (user) {
      resetProfile({ fullName: user.fullName || "", email: user.email || "" });
      setAvatarPreview(user.avatarUrl || null);
    }
    setEditing(false);
  }

  async function onPasswordSave(values: PasswordValues) {
    const result = await changePassword(values.currentPassword, values.newPassword);
    if (result.ok) {
      toast.success("Password changed", {
        description: "Your security credentials have been updated successfully.",
      });
      resetPwd();
    } else {
      toast.error("Change failed", {
        description: result.error ?? "The current password you entered is incorrect.",
      });
    }
  }

  const inputCls = cn(
    "w-full h-10 rounded-xl",
    "bg-white/[0.04] border border-white/[0.08]",
    "px-3.5 text-sm text-white/85 placeholder:text-white/25",
    "focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30",
    "transition-colors duration-150",
  );

  if (!hasFetched || (isLoading && !user)) {
    return <SettingSkeleton />;
  }

  return (
    <div className="p-6 lg:p-8 max-w-2xl">
      {/* Page title */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease }}
        className="mb-8 flex items-center justify-between"
      >
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white/90">Profile</h1>
          <p className="mt-1 text-sm text-white/40">Manage your personal information.</p>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className={cn(
              "h-9 px-4 rounded-xl text-sm font-medium",
              "border border-white/[0.12] text-white/60",
              "hover:border-white/25 hover:text-white/85",
              "transition-colors duration-150",
            )}
          >
            Edit Profile
          </button>
        )}
      </motion.div>

      {/* Avatar section */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease, delay: 0.05 }}
        className={cn(
          "border border-white/[0.06] rounded-xl p-6 bg-surface",
          "mb-5",
        )}
      >
        <h2 className="text-sm font-medium text-white/70 mb-4">Profile Picture</h2>
        <div className="flex items-center gap-5">
          <div
            className={cn(
              "w-16 h-16 rounded-2xl shrink-0 overflow-hidden",
              "bg-accent/20 border border-accent/30",
              "flex items-center justify-center",
              "text-xl font-semibold text-accent select-none",
            )}
          >
            {avatarPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <button
              type="button"
              disabled={!editing}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "h-8 px-4 rounded-lg text-xs font-medium",
                "border border-white/[0.12] text-white/60",
                "hover:border-white/25 hover:text-white/85",
                "transition-colors duration-150",
                !editing && "opacity-50 cursor-not-allowed",
              )}
            >
              Upload new photo
            </button>
            {editing && avatarPreview && (
              <button
                type="button"
                onClick={() => setAvatarPreview(null)}
                className="block text-[11px] text-red-400/70 hover:text-red-400 transition-colors"
              >
                Remove photo
              </button>
            )}
            <p className="text-[11px] text-white/30">JPG, PNG or GIF Â· Max 2 MB</p>
          </div>
        </div>
      </motion.div>

      {/* Info form */}
      <motion.form
        onSubmit={handleProfile(onProfileSave)}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease, delay: 0.1 }}
        className={cn(
          "border border-white/[0.06] rounded-xl p-6 bg-surface",
        )}
      >
        <h2 className="text-sm font-medium text-white/70 mb-5">Personal Information</h2>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/50" htmlFor="fullName">Full Name</label>
            <input
              id="fullName"
              type="text"
              autoComplete="name"
              readOnly={!editing}
              {...regProfile("fullName")}
              placeholder="Your full name"
              className={cn(inputCls, !editing && "opacity-50 cursor-not-allowed")}
            />
            {profileErrors.fullName && (
              <p className="text-xs text-red-400">{profileErrors.fullName.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/50" htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              readOnly={!editing}
              {...regProfile("email")}
              placeholder="you@example.com"
              className={cn(inputCls, !editing && "opacity-50 cursor-not-allowed")}
            />
            {profileErrors.email && (
              <p className="text-xs text-red-400">{profileErrors.email.message}</p>
            )}
          </div>
        </div>

        {editing && (
          <div className="flex items-center justify-end gap-2 mt-6 pt-5 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={handleCancel}
              className={cn(
                "h-9 px-5 rounded-xl text-sm",
                "bg-white/[0.06] border border-white/[0.08]",
                "text-white/60 hover:text-white/80",
                "transition-all duration-150",
              )}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={profileSaving}
              className={cn(
                "h-9 px-5 rounded-xl text-sm font-medium",
                "bg-white text-black",
                "hover:bg-white/80 active:scale-95",
                "transition-all duration-150 ease-spatial",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
              )}
            >
              {profileSaving ? "Savingâ€¦" : "Save Changes"}
            </button>
          </div>
        )}
      </motion.form>

      {/* Change password */}
      <motion.form
        onSubmit={handlePwd(onPasswordSave)}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease, delay: 0.15 }}
        className={cn(
          "border border-white/[0.06] rounded-xl p-6 bg-surface mt-5",
        )}
      >
        <h2 className="text-sm font-medium text-white/70 mb-5">Change Password</h2>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/50" htmlFor="currentPassword">Current Password</label>
            <input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              {...regPwd("currentPassword")}
              placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
              className={inputCls}
            />
            {pwdErrors.currentPassword && (
              <p className="text-xs text-red-400">{pwdErrors.currentPassword.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/50" htmlFor="newPassword">New Password</label>
            <input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              {...regPwd("newPassword")}
              placeholder="Minimum 8 characters"
              className={inputCls}
            />
            {pwdErrors.newPassword && (
              <p className="text-xs text-red-400">{pwdErrors.newPassword.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/50" htmlFor="confirmPassword">Confirm New Password</label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              {...regPwd("confirmPassword")}
              placeholder="Repeat new password"
              className={inputCls}
            />
            {pwdErrors.confirmPassword && (
              <p className="text-xs text-red-400">{pwdErrors.confirmPassword.message}</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end mt-6 pt-5 border-t border-white/[0.06]">
          <button
            type="submit"
            disabled={pwdSaving}
            className={cn(
              "h-9 px-5 rounded-xl text-sm font-medium",
              "bg-white text-black",
              "hover:bg-white/80 active:scale-95",
              "transition-all duration-150 ease-spatial",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
            )}
          >
            {pwdSaving ? "Changingâ€¦" : "Change Password"}
          </button>
        </div>
      </motion.form>

      {/* Account info */}
      {user && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease, delay: 0.2 }}
          className={cn(
            "border border-white/[0.06] rounded-xl p-6 bg-surface mt-5",
          )}
        >
          <h2 className="text-sm font-medium text-white/70 mb-4">Account</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <div className="space-y-0.5">
              <p className="text-[11px] text-white/35 uppercase tracking-wider">Plan</p>
              <p className="text-sm text-white/80 font-medium capitalize">{user.tier}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[11px] text-white/35 uppercase tracking-wider">Member Since</p>
              <p className="text-sm text-white/80 font-medium">
                {user.createdAt
                  ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                  : "â€”"}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
