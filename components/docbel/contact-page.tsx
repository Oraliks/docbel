"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Mail, MessageCircle, Clock, CheckCircle2 } from "lucide-react";

interface ContactPageProps {
  accent: string;
}

// Email obfuscation: stored as array to prevent bot scraping
const CONTACT_EMAIL_PARTS = ["contact", "docbel", "be"];
const getContactEmail = () => CONTACT_EMAIL_PARTS.join("@").replace("@be", ".be");

export function ContactPage({ accent }: ContactPageProps) {
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
  const [contactEmail, setContactEmail] = useState("");

  // Decode email on client-side only
  useEffect(() => {
    setContactEmail(getContactEmail());
  }, []);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/contact-messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          subject: formData.subject,
          message: formData.message,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit message");
      }

      setSubmitted(true);
      setFormData({ name: "", email: "", subject: "", message: "" });
      setAcceptData(false);

      setTimeout(() => setSubmitted(false), 4000);
    } catch (err) {
      setError("Une erreur est survenue. Veuillez réessayer.");
      console.error("Error submitting form:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid =
    formData.name && formData.email && formData.subject && formData.message && acceptData;

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight">Nous contacter</h1>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left: Contact Form */}
        <div className="lg:col-span-2">
          <Card className="border">
            <CardHeader>
              <CardTitle>Envoyer un message</CardTitle>
              <CardDescription>Remplissez le formulaire ci-dessous et nous vous contactrons sous 48 heures</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Full Name */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Nom complet</label>
                  <Input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Votre nom et prénom"
                    required
                    className="h-10"
                  />
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Adresse e-mail</label>
                  <Input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="exemple@email.com"
                    required
                    className="h-10"
                  />
                </div>

                {/* Subject */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Sujet</label>
                  <select
                    name="subject"
                    value={formData.subject}
                    onChange={handleInputChange}
                    required
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="">Sélectionnez un sujet</option>
                    <option value="question">Question générale</option>
                    <option value="technique">Problème technique</option>
                    <option value="feedback">Suggestion ou feedback</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>

                {/* Message */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Votre message</label>
                  <Textarea
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    placeholder="Décrivez votre demande en détail..."
                    rows={6}
                    required
                  />
                </div>

                {/* Checkbox */}
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="acceptData"
                    checked={acceptData}
                    onChange={(e) => setAcceptData(e.target.checked)}
                    className="mt-1 cursor-pointer accent-red-600"
                  />
                  <label htmlFor="acceptData" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                    J'accepte que mes données soient utilisées pour traiter ma demande conformément à notre
                    politique de confidentialité.
                  </label>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-600 text-sm flex gap-2 items-start">
                    <span className="mt-0.5">⚠️</span>
                    <span>{error}</span>
                  </div>
                )}

                {/* Success Message */}
                {submitted && (
                  <div className="p-3 rounded-md bg-green-50 border border-green-200 text-green-600 text-sm flex gap-2 items-start">
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <span>Merci ! Votre message a été envoyé avec succès.</span>
                  </div>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={!isFormValid || isLoading || submitted}
                  className="w-full h-10"
                  style={{
                    backgroundColor: isFormValid && !isLoading ? accent : undefined,
                    opacity: submitted ? 0.8 : 1,
                  }}
                >
                  {isLoading && <span className="animate-spin mr-2">⟳</span>}
                  {isLoading ? "Envoi en cours..." : submitted ? "Message envoyé ✓" : "Envoyer le message"}
                </Button>

                {/* Info */}
                <div className="flex gap-2 text-xs text-muted-foreground pt-2">
                  <Clock className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>Nous nous engageons à vous répondre sous 48h ouvrées.</span>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right: Contact Info Cards */}
        <div className="space-y-4">
          {/* Email Card */}
          <Card className="border">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Mail className="w-5 h-5 text-red-600" />
                E-mail
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">Écrivez-nous directement :</p>
              {contactEmail && (
                <a
                  href={`mailto:${contactEmail}`}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-red-50 border border-red-200 hover:bg-red-100 transition-colors"
                >
                  <span className="text-sm font-semibold text-red-600">{contactEmail}</span>
                </a>
              )}
            </CardContent>
          </Card>

          {/* Response Time Card */}
          <Card className="border">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-red-600" />
                Délai de réponse
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Nous traitons votre demande <span className="font-semibold">sous 48 heures ouvrées</span>.
              </p>
            </CardContent>
          </Card>

          {/* Privacy Info */}
          <Card className="border bg-slate-50 dark:bg-slate-900/30">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <span>🔒</span>
                Vos données
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Vos données sont traitées avec confidentialité et conformément à notre politique de
                protection des données. Nous ne les partagerons jamais avec des tiers.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

    </div>
  );
}
