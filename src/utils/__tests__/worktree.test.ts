import { describe, expect, it } from 'bun:test';
import { validateWorktreeSlug, worktreeBranchName } from '../worktree.js';

describe('worktree utils', () => {
  describe('validateWorktreeSlug', () => {
    it('should allow valid slugs', () => {
      expect(() => validateWorktreeSlug('agent-123')).not.toThrow();
      expect(() => validateWorktreeSlug('feature_branch')).not.toThrow();
      expect(() => validateWorktreeSlug('user/feature')).not.toThrow();
    });

    it('should reject path traversal', () => {
      expect(() => validateWorktreeSlug('../outside')).toThrow(/must not contain/);
      expect(() => validateWorktreeSlug('./current')).toThrow(/must not contain/);
      expect(() => validateWorktreeSlug('dir/../dir')).toThrow(/must not contain/);
    });

    it('should reject invalid characters', () => {
      expect(() => validateWorktreeSlug('invalid space')).toThrow(/only letters, digits, dots, underscores, and dashes/);
      expect(() => validateWorktreeSlug('invalid$char')).toThrow(/only letters, digits, dots, underscores, and dashes/);
    });

    it('should reject empty segments', () => {
      expect(() => validateWorktreeSlug('/leading')).toThrow();
      expect(() => validateWorktreeSlug('trailing/')).toThrow();
      expect(() => validateWorktreeSlug('double//slash')).toThrow();
    });

    it('should reject overly long slugs', () => {
      const longSlug = 'a'.repeat(65);
      expect(() => validateWorktreeSlug(longSlug)).toThrow(/must be 64 characters or fewer/);
    });
  });

  describe('worktreeBranchName', () => {
    it('should flatten slashes in branch names', () => {
      expect(worktreeBranchName('user/feature')).toBe('worktree-user+feature');
    });

    it('should handle simple names', () => {
      expect(worktreeBranchName('agent-1')).toBe('worktree-agent-1');
    });
  });
});
