import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, it, expect } from "vitest";
import messages from "@/messages/fr.json";
import { FormAnswerSummary } from "../form-answer-summary";
import { applyFieldDerivations } from "@/lib/pdf-forms/field-derivations";
import { toPublicField } from "@/lib/pdf-forms/public-serializer";

describe("form answer summary", () => {
  it("reads real visible answers, options and structured rows without changing the payload", () => {
    const fields = [
      toPublicField({id:"choice",pdfFieldName:"",type:"radio",required:true,label:{fr:"Choix"},options:[{value:"other",label:{fr:"Autre réponse"}}]}),
      toPublicField({id:"detail",pdfFieldName:"",type:"text",required:false,label:{fr:"Détail"},visibleIf:{fieldId:"choice",op:"equals",value:"hidden"}}),
      toPublicField({id:"zero",pdfFieldName:"",type:"number",required:false,label:{fr:"Nombre"}}),
      toPublicField({id:"no",pdfFieldName:"",type:"checkbox",required:false,label:{fr:"Option"}}),
      toPublicField({id:"people",pdfFieldName:"",type:"array",required:false,label:{fr:"Personnes"},itemFields:[{id:"name",pdfFieldName:"",type:"text",required:false,label:{fr:"Prénom"}}]}),
    ];
    const values = {choice:"other",detail:"INVISIBLE",zero:0,no:false,people:[{name:"Personne synthétique"}]};
    const before=JSON.stringify(values);
    const summary=createElement(FormAnswerSummary,{fields,values,locale:"fr",editableFieldIds:fields.map(field=>field.id),onEdit:()=>{}});
    // eslint-disable-next-line react/no-children-prop
    const html=renderToStaticMarkup(createElement(NextIntlClientProvider,{locale:"fr",messages,children:summary}));
    expect(html).toContain("Autre réponse");
    expect(html).not.toContain("INVISIBLE");
    expect(html).toContain(">0</bdi>");
    expect(html).toContain("Non");
    expect(html).toContain("Personne synthétique");
    expect(html).toContain("Modifier la réponse : Choix");
    expect(JSON.stringify(values)).toBe(before);
  });
  it("shows the existing derived view and only offers edits with real editable destinations", () => {
    const fields = [
      toPublicField({id:"postal",pdfFieldName:"",type:"text",required:true,label:{fr:"Code postal"}}),
      toPublicField({id:"country",pdfFieldName:"",type:"text",required:false,label:{fr:"Pays"},derivedFrom:{fieldId:"postal",via:"postal-be-country"}}),
      toPublicField({id:"created",pdfFieldName:"",type:"date",required:false,label:{fr:"Date du document"},prefillFrom:"system.today"}),
      toPublicField({id:"unmapped",pdfFieldName:"",type:"text",required:false,label:{fr:"Sans étape"}}),
    ];
    const values={postal:"1000",country:"Ancienne valeur",created:"2026-10-23",unmapped:"Conservé"};
    const view=applyFieldDerivations(values,fields);
    const summary=createElement(FormAnswerSummary,{fields,values:view,locale:"fr",editableFieldIds:["postal","country","created"],onEdit:()=>{}});
    // eslint-disable-next-line react/no-children-prop
    const html=renderToStaticMarkup(createElement(NextIntlClientProvider,{locale:"fr",messages,children:summary}));
    expect(html).toContain("Belgique");
    expect(html).not.toContain("Ancienne valeur");
    expect(html).toContain("Modifier la réponse : Code postal");
    expect(html).not.toContain("Modifier la réponse : Pays");
    expect(html).not.toContain("Modifier la réponse : Date du document");
    expect(html).not.toContain("Modifier la réponse : Sans étape");
    expect(values.country).toBe("Ancienne valeur");
  });

});
