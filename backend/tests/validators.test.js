// Tests unitaires purs (aucune base de données requise) pour les règles de
// validation des entrées utilisateur — exigence cahier des charges,
// section 7 : "les entrées utilisateur sont validées".

import { describe, it, expect } from 'vitest';
import {
  validateRegisterInput,
  validateLoginInput,
  sanitizeText,
} from '../src/utils/validators.js';

describe('validateRegisterInput', () => {
  it('accepte des données valides', () => {
    const errors = validateRegisterInput({
      email: 'alice@example.com',
      username: 'alice',
      password: 'motdepasse123',
    });
    expect(errors).toEqual([]);
  });

  it("rejette un email sans '@'", () => {
    const errors = validateRegisterInput({
      email: 'alice-exemple.com',
      username: 'alice',
      password: 'motdepasse123',
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join(' ')).toMatch(/email/i);
  });

  it("rejette un nom d'utilisateur trop court", () => {
    const errors = validateRegisterInput({
      email: 'alice@example.com',
      username: 'al',
      password: 'motdepasse123',
    });
    expect(errors.join(' ')).toMatch(/utilisateur/i);
  });

  it('rejette un mot de passe de moins de 8 caractères', () => {
    const errors = validateRegisterInput({
      email: 'alice@example.com',
      username: 'alice',
      password: 'court1',
    });
    expect(errors.join(' ')).toMatch(/mot de passe/i);
  });

  it('cumule plusieurs erreurs à la fois', () => {
    const errors = validateRegisterInput({ email: '', username: '', password: '' });
    expect(errors.length).toBe(3);
  });
});

describe('validateLoginInput', () => {
  it('accepte email + mot de passe présents', () => {
    expect(validateLoginInput({ email: 'a@b.com', password: 'x' })).toEqual([]);
  });

  it('rejette une absence de mot de passe', () => {
    const errors = validateLoginInput({ email: 'a@b.com', password: '' });
    expect(errors.length).toBe(1);
  });
});

describe('sanitizeText', () => {
  it('retire les espaces superflus', () => {
    expect(sanitizeText('  bonjour  ')).toBe('bonjour');
  });

  it("rejette une chaîne vide ou composée uniquement d'espaces", () => {
    expect(sanitizeText('   ')).toBeNull();
    expect(sanitizeText('')).toBeNull();
  });

  it('rejette une valeur non textuelle', () => {
    expect(sanitizeText(42)).toBeNull();
    expect(sanitizeText(null)).toBeNull();
    expect(sanitizeText(undefined)).toBeNull();
  });

  it('rejette un texte dépassant la longueur maximale', () => {
    const tooLong = 'a'.repeat(5001);
    expect(sanitizeText(tooLong)).toBeNull();
  });

  it('accepte un texte à la limite exacte de longueur', () => {
    const exact = 'a'.repeat(5000);
    expect(sanitizeText(exact)).toBe(exact);
  });
});
