TEXTURE SCIENCE LABS / REGIRL Regirl QC Vision App --- Product
Requirements Document Version 2.0 \| Active Pilot Style: Soft Siren \|
Future Styles: Sweet Siren, Spicy Icon, Soft Madame, Midnight Muse,
Mother, Soft Girl

1.  Problem Statement Regirl's QC process for wig styling relies
    entirely on a human supervisor's visual judgment. Over time,
    supervisors develop tolerance creep --- subtly accepting styles that
    deviate from the reference, which trains stylists to reproduce those
    deviations. The result is inconsistent product quality that erodes
    brand reputation and increases rework and return costs.

The core issue is not that supervisors do not care --- it is that they
have no objective, unchanging reference to check against. Human memory
drifts. A system does not.

2.  Solution Overview A Progressive Web App (PWA) installed on a
    dedicated QC phone. The supervisor places the finished wig on a
    mannequin head in a standardised lighting environment, photographs
    the wig from required angles using the phone's native camera app,
    then opens the PWA and uploads the photos from the device's media
    gallery.

A vision AI model evaluates each submitted photo against a structured
checklist of style criteria for that specific wig style, comparing it
against the stored reference images. The app returns a verdict per
criterion with specific failure reasons and AI-generated rework
instructions.

There is no custom model training required. The system uses a
vision-capable LLM API (Gemini 1.5 Flash as the primary model, with
GPT-4o Vision as fallback for low-confidence results) with reference
images and a structured evaluation rubric embedded in the prompt. This
makes the system fully vibe-codeable without machine learning
engineering.

3.  Pilot Scope

4.  Device & Hardware Requirements 4.1 Recommended Phone iPhone 11 or
    iPhone 12. Reasons: Night Mode enables better detail capture on
    dark-toned wigs in variable indoor lighting, Smart HDR improves
    contrast recovery, and camera hardware is consistent across units
    (unlike mid-tier Android which varies significantly by
    manufacturer).

Minimum acceptable Android alternative: Samsung Galaxy A54 or equivalent
with a 50MP+ main sensor and OIS. The single most critical hardware
factor is low-light performance for dark wig photography. Avoid devices
with poor night mode.

4.2 Required Physical Accessories

5.  Photo Capture & Upload Workflow The supervisor does not take photos
    from within the app. The workflow is intentionally separated into
    two stages.

Stage 1 --- Capture (outside the app) Set up the QC environment
following the daily setup checklist in the app. Place the completed wig
on the mannequin head. Using the phone's native camera app, photograph
the wig from each required angle per the diagram guide posted at the QC
station. Retake any photos that are blurry, poorly lit, or missing part
of the wig before proceeding. All photos are automatically saved to the
device's camera roll.

Stage 2 --- Upload and evaluate (inside the app) Open the Regirl QC app
from the home screen. Select the wig style from the style list. Enter
the name of the stylist who made the wig and wig ID (there's a physical
checklist paper attached to the wig that contains the stylist's name and
wig ID). Upload photos from the gallery --- one per angle slot. The app
shows a labelled diagram for each slot so the supervisor knows which
photo belongs where. Submit. The app sends all photos to the vision API
with the criteria rubric and reference images. Review the pass/fail
verdict and rework instructions. Print or show the instructions to the
stylist for any failed criteria.

6.  Standardised Environment --- Daily Setup SOP The app shows a setup
    checklist screen before the first QC session of each day. The
    supervisor taps through each item to confirm the environment is
    ready. Without this confirmation, the app will not allow a session
    to begin.

7.  How the System Handles Styling Nuances Different styles require
    different evaluation approaches. The vision model cannot recover
    true 3D measurements from a 2D photo, but it can perform reliable
    visual conformity checks when given the right reference images and
    prompt engineering. The system classifies each evaluation type and
    applies the appropriate approach.

7.1 Evaluation Type Classification

7.2 Ruler-Based Length Evaluation The ruler appears in every photo but
does not need to start at the wig crown or end at the hem. Its purpose
is to give the vision model a proportional scale reference so it can
reason about relative measurements.

For reference images, we will annotate the image with a note such as:
'Hair hem aligns with the 22cm graduation on the ruler.' This is stored
as metadata alongside the reference image. When the supervisor submits a
QC photo, the model is told: 'The reference wig hem aligns with the 22cm
graduation. In this submission, identify where the hair hem falls
relative to the ruler. Report whether it is above, at, or below the 22cm
mark.'

7.3 Flip and Curved End Evaluation (Sweet Siren, Spicy Icon) For styles
with flipped or curved ends, the model does not measure flip depth in
absolute inches. It evaluates proportional consistency with the
reference using the ruler as a scale anchor.

Prompt approach: 'The reference image shows the correct flip depth at
the ends. Using the ruler graduation visible in both images as a scale
reference, assess whether the flip depth in this submission is
proportionally consistent with the reference, significantly shallower,
or significantly deeper.'

7.4 Wave and Curl Pattern Evaluation (Soft Madame, Spicy Icon) For wavy
and bouncy styles, the model does not measure individual wave size. It
evaluates pattern uniformity and overall hem position.

Prompt approach: 'This is a layered wavy style. Evaluate whether: (1)
the wave pattern is uniformly consistent throughout the length from
crown to hem, with no sections that are significantly tighter, looser,
or flatter than the reference; (2) the overall hem position aligns with
the reference ruler mark; (3) the wave depth and frequency visually
match the reference.'

8.  How the Checklist Drives the System (Technical Architecture) 8.1
    Reference Image Storage Before the app goes live for any style, the
    admin uploads 3--5 reference photos per capture angle for a
    gold-standard wig. For each reference image, the admin also enters a
    short annotation note describing the key measurement or proportional
    detail visible at that angle (e.g. 'Hem aligns with 22cm ruler mark.
    Layer graduation shows 3 distinct breaks.'). These notes are stored
    alongside the reference images and are included in the evaluation
    prompt.

Reference images are permanent once approved. They cannot be changed
without a formal product revision logged in the system.

8.2 Submission Payload Construction When the supervisor submits a QC
session, the app assembles a separate evaluation payload for each
capture angle containing: the supervisor's submitted photo for that
angle, the reference photos for that angle (sent as image URLs), the
reference annotation notes, the list of criteria relevant to that angle,
the evaluation type (CONFORMITY / PROPORTIONAL / POSITIONAL / SURFACE),
and a structured system prompt.

8.3 Vision Model Prompt Template Below is the base prompt structure used
for each angle evaluation. Style-specific nuance instructions are
injected at the \[STYLE_NUANCE_CONTEXT\] placeholder.

8.4 Result Aggregation and Verdict Logic

8.5 Rework Instruction Generation The vision model generates rework
instructions as part of its per-criterion output when a criterion fails.
Instructions are in plain English, 2--3 sentences, specific to the
observed deviation, and reference the relevant capture angle. The
supervisor prints or reads these instructions to the stylist.

Feedback loop: After the wig is reworked and resubmitted, the supervisor
rates the previous rework instruction as Helpful or Not Helpful. This
rating is stored alongside the session log. After 50+ sessions, this
feedback is used to refine the prompt language for that criterion.

9.  Active Pilot Style: Soft Siren

9.1 Style Overview

9.2 Style Nuance Context (injected into every prompt) The following
paragraph is injected at the \[STYLE_NUANCE_CONTEXT\] placeholder in
every Soft Siren evaluation prompt:

9.3 Capture Angles --- Soft Siren

9.4 QC Criteria Checklist --- Soft Siren

9.5 Severity Classification for Soft Siren Any criterion not explicitly
listed above defaults to MINOR. The following override rules apply: Any
criterion that makes the wig unsellable to a customer upon delivery =
MAJOR Any criterion that violates the ReXI brand promise (texture,
sheen, durability) = MAJOR Any criterion visible to the customer during
normal wear = MAJOR Subtle deviations the customer is unlikely to notice
in normal wear = MINOR

10. Future Styles --- Reference Library

10.1 Sweet Siren Style overview

Style nuance context (for prompt injection)

Capture angles --- Sweet Siren

QC criteria --- Sweet Siren

10.2 Spicy Icon Style overview

Style nuance context (for prompt injection)

Capture angles --- Spicy Icon

QC criteria --- Spicy Icon

10.3 Soft Madame Style overview

Style nuance context (for prompt injection)

Capture angles --- Soft Madame

QC criteria --- Soft Madame

10.4 Midnight Muse Style overview

Style nuance context (for prompt injection)

Capture angles --- Midnight Muse

QC criteria --- Midnight Muse

10.5 Mother Style overview

Style nuance context (for prompt injection)

Capture angles --- Mother

QC criteria --- Mother

10.6 Soft Girl Style overview

Style nuance context (for prompt injection)

Capture angles --- Soft Girl

QC criteria --- Soft Girl

11. Data Model The data model is built style-first from day one. Nothing
    is hardcoded for Soft Siren. Adding a new style requires uploading
    reference images and defining criteria in the admin panel --- no
    code changes required after Phase 4.

12. Technical Stack

13. Phased Rollout

14. Out of Scope for Pilot Barcode or QR scanning of wig IDs (manual
    entry is sufficient for pilot) Offline mode (API calls require
    internet connection --- assume WiFi at production location)
    Automated rework tracking or stylist performance scoring (data
    collected but dashboards deferred to Phase 4) Integration with
    Shopify or inventory systems Multi-supervisor role management Mobile
    push notifications

15. Open Items Before Development Begins

16. Additional Notes For Developer The app should have multiple tabs. So
    we don't need one session to be done before the next session can
    start this way the supervisor can upload the images as they take it.
    They do not have to take all pictures before uploading it. The app
    will have an interface to show the history of every wig that has
    gone through the QC process. The UI will be a table with a date
    picker which always defaults to last 3 days in descending order. The
    view will contain the SKU name, stylist name, and the verdict. Each
    row on the table will have a toggle where the user can see the
    uploaded images for each angle and the generative text from the AI
    letting us know what should be corrected. This wig history will also
    be visible on the admin panel. The admin panel should have a clear
    way to update/change he reference image on the back end When
    selecting the wig type we want to QC, the supervisor will select the
    SKU name from a list instead of writing in the wig name. For
    instance, we have 2 SKUs for Soft siren because we have 2 color
    variations of the wig Each style comes in multiple color variations,
    we won't be create a reference model for each color variation. The
    prompt we include for analysis needs to let the model know that the
    colors are not what it is testing for. However, the 3 - 5 images we
    upload for each angle for our reference model has to cover every
    color variation of the wig. Additionally, the model needs to know
    where a color should appear as some styles have slight color
    highlights only in specific places on the wig. If the style fails
    QA, the model points out which place there's an issue. E.g: front of
    the wig, back of wig, et al. Plus generative text describing what
    the problem is. We will host all our data on Digital Ocean. The pRD
    suggest Vercel or Netlify, but we need to do a cost comparison to
    determine this as we already have a monthly subscription to DO that
    costs us \$48 per month. Sync all data in our database into Metabase
    which will also be hosted on DO.
