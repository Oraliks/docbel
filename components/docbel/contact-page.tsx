"use client";

import { useState } from "react";
import { CheckCircle2Icon, ClockIcon, MailIcon, MessageCircleIcon, ShieldCheckIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface ContactPageProps {
  accent: string;
}

const CONTACT_EMAIL_PARTS = ["contact", "docbel", "be"];
const getContactEmail = () => CONTACT_EMAIL_PARTS.join("@").replace("@be", ".be");

export function ContactPage(_: ContactPageProps) {
  void _;
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [acceptData, setAcceptData] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [contactEmail] = useState(() => getContactEmail());

  const handleInputChange = (name: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/contact-messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Failed to submit message");
      }

      setSubmitted(true);
      setFormData({ name: "", email: "", subject: "", message: "" });
      setAcceptData(false);

      window.setTimeout(() => setSubmitted(false), 4000);
    } catch (err) {
      console.error("Error submitting form:", err);
      setError("Une erreur est survenue. Veuillez reessayer.");
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid =
    formData.name && formData.email && formData.subject && formData.message && acceptData;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-semibold tracking-tight">Nous contacter</h1>
        <p className="max-w-2xl text-muted-foreground">
          Une question sur un document, une demarche ou un contenu public ? Ecrivez-nous.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Envoyer un message</CardTitle>
            <CardDescription>
              Remplissez le formulaire ci-dessous. Nous revenons vers vous sous 48 heures ouvrees.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              {error && (
                <Alert variant="destructive">
                  <MessageCircleIcon />
                  <AlertTitle>Envoi impossible</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {submitted && (
                <Alert>
                  <CheckCircle2Icon />
                  <AlertTitle>Message envoye</AlertTitle>
                  <AlertDescription>
                    Merci. Votre demande a bien ete enregistree.
                  </AlertDescription>
                </Alert>
              )}

              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="contact-name">Nom complet</FieldLabel>
                  <Input
                    id="contact-name"
                    value={formData.name}
                    onChange={(event) => handleInputChange("name", event.target.value)}
                    placeholder="Votre nom et prenom"
                    required
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="contact-email">Adresse e-mail</FieldLabel>
                  <Input
                    id="contact-email"
                    type="email"
                    value={formData.email}
                    onChange={(event) => handleInputChange("email", event.target.value)}
                    placeholder="vous@exemple.be"
                    required
                  />
                </Field>

                <Field>
                  <FieldLabel>Sujet</FieldLabel>
                  <Select
                    value={formData.subject}
                    onValueChange={(value) => handleInputChange("subject", value ?? "")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selectionnez un sujet" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="question">Question generale</SelectItem>
                        <SelectItem value="technique">Probleme technique</SelectItem>
                        <SelectItem value="feedback">Suggestion ou retour</SelectItem>
                        <SelectItem value="autre">Autre sujet</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel htmlFor="contact-message">Votre message</FieldLabel>
                  <Textarea
                    id="contact-message"
                    value={formData.message}
                    onChange={(event) => handleInputChange("message", event.target.value)}
                    placeholder="Decrivez votre demande..."
                    rows={7}
                    required
                  />
                </Field>

                <Field orientation="horizontal">
                  <Checkbox
                    checked={acceptData}
                    onCheckedChange={(value) => setAcceptData(Boolean(value))}
                    aria-label="Accepter la politique de confidentialite"
                  />
                  <div className="flex flex-col gap-1">
                    <FieldLabel>J&apos;accepte le traitement de mes donnees</FieldLabel>
                    <FieldDescription>
                      Elles seront utilisees uniquement pour repondre a votre message.
                    </FieldDescription>
                  </div>
                </Field>
              </FieldGroup>

              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <ClockIcon className="size-4" />
                  Reponse en 48h ouvrees
                </span>
                <Button type="submit" disabled={!isFormValid || isLoading || submitted}>
                  {isLoading ? "Envoi en cours..." : "Envoyer le message"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2">
                <MailIcon className="size-5 text-primary" />
                E-mail
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">Contact direct pour vos demandes generales.</p>
              <Button variant="outline" render={<a href={`mailto:${contactEmail}`} />}>
                {contactEmail}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2">
                <MessageCircleIcon className="size-5 text-primary" />
                Delai de reponse
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Notre equipe traite les demandes sous <span className="font-medium text-foreground">48 heures ouvrees</span>.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2">
                <ShieldCheckIcon className="size-5 text-primary" />
                Confidentialite
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Vos donnees restent confidentielles et ne sont jamais revendues ni diffusees.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
