"use client";

import {
  FormProvider,
  type FieldValues,
  type UseFormReturn,
} from "react-hook-form";

type FormProps<TFieldValues extends FieldValues> = Omit<
  React.ComponentProps<"form">,
  "onSubmit"
> & {
  form: UseFormReturn<TFieldValues>;
  onSubmit: React.ComponentProps<"form">["onSubmit"];
};

export function Form<TFieldValues extends FieldValues>({
  form,
  onSubmit,
  ...props
}: FormProps<TFieldValues>) {
  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} {...props} />
    </FormProvider>
  );
}
