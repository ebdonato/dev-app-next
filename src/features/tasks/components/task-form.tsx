"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { z } from "zod";
import { createTaskInput } from "../task.schema";
import type { CreateTaskInput } from "../task.schema";
import styles from "./task-form.module.css";

type Field = "titulo" | "descricao";
type FieldErrors = Partial<Record<Field, string[]>>;

/** What the backend said, mapped by the parent page (the form knows no tRPC). */
export type TaskFormServerError = {
  message?: string;
  fieldErrors?: FieldErrors;
};

export type TaskFormProps = {
  initialValues?: { titulo: string; descricao?: string };
  submitLabel: string;
  onSubmit: (values: CreateTaskInput) => Promise<void>;
  isSubmitting: boolean;
  serverError?: TaskFormServerError;
};

/**
 * Shared create/edit form. Presentational and stateful: the parent runs the
 * mutation, owns `isSubmitting` and passes back server errors.
 */
export function TaskForm({
  initialValues,
  submitLabel,
  onSubmit,
  isSubmitting,
  serverError,
}: Readonly<TaskFormProps>) {
  const [values, setValues] = useState({
    titulo: initialValues?.titulo ?? "",
    descricao: initialValues?.descricao ?? "",
  });
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});
  // Fields edited since the last submit: their server error is outdated.
  const [editedFields, setEditedFields] = useState<Field[]>([]);

  const tituloRef = useRef<HTMLInputElement>(null);
  const descricaoRef = useRef<HTMLTextAreaElement>(null);
  const id = useId();

  // The form is server-rendered, so the user can type before React hydrates.
  // Hydration keeps that text in the DOM but fires no onChange, so state would
  // still hold the initial values and submit them. Adopt the DOM values once,
  // right after hydration, so what is submitted is what the user sees.
  useEffect(() => {
    const titulo = tituloRef.current?.value;
    const descricao = descricaoRef.current?.value;
    if (titulo === undefined || descricao === undefined) return;
    setValues((current) =>
      current.titulo === titulo && current.descricao === descricao
        ? current
        : { titulo, descricao },
    );
  }, []);

  // Client errors win; a server error shows until the user edits the field.
  function errorFor(field: Field): string | undefined {
    if (clientErrors[field]) return clientErrors[field][0];
    if (editedFields.includes(field)) return undefined;
    return serverError?.fieldErrors?.[field]?.[0];
  }

  function handleChange(field: Field, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setClientErrors((current) => ({ ...current, [field]: undefined }));
    setEditedFields((current) => (current.includes(field) ? current : [...current, field]));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    // Same schema as the tRPC procedure, so client and server rules can't drift.
    const result = createTaskInput.safeParse(values);
    if (!result.success) {
      const { fieldErrors } = z.flattenError(result.error);
      setClientErrors(fieldErrors);
      (fieldErrors.titulo ? tituloRef : descricaoRef).current?.focus();
      return;
    }

    setClientErrors({});
    setEditedFields([]);
    try {
      // Parsed values: trimmed, empty description normalized to undefined.
      await onSubmit(result.data);
    } catch {
      // The parent reports failures through `serverError`; values are kept.
    }
  }

  const tituloError = errorFor("titulo");
  const descricaoError = errorFor("descricao");

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.field}>
        <label htmlFor={`${id}-titulo`} className={styles.label}>
          Title
        </label>
        <input
          ref={tituloRef}
          id={`${id}-titulo`}
          name="titulo"
          type="text"
          value={values.titulo}
          onChange={(event) => handleChange("titulo", event.target.value)}
          aria-invalid={tituloError ? true : undefined}
          aria-describedby={tituloError ? `${id}-titulo-error` : undefined}
        />
        {tituloError && (
          <p id={`${id}-titulo-error`} className={styles.error}>
            {tituloError}
          </p>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor={`${id}-descricao`} className={styles.label}>
          Description <span className={styles.optional}>(optional)</span>
        </label>
        <textarea
          ref={descricaoRef}
          id={`${id}-descricao`}
          name="descricao"
          rows={4}
          value={values.descricao}
          onChange={(event) => handleChange("descricao", event.target.value)}
          aria-invalid={descricaoError ? true : undefined}
          aria-describedby={descricaoError ? `${id}-descricao-error` : undefined}
        />
        {descricaoError && (
          <p id={`${id}-descricao-error`} className={styles.error}>
            {descricaoError}
          </p>
        )}
      </div>

      {serverError?.message && (
        <p role="alert" className={styles.alert}>
          {serverError.message}
        </p>
      )}

      <div className={styles.actions}>
        <button type="submit" className="button" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : submitLabel}
        </button>
        <Link href="/">Cancel</Link>
      </div>
    </form>
  );
}
