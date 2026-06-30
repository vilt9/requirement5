A url (different from root) where a user (don't worry about being logged in) can a new card image.

This page should allow them to configure the exact apperance of the card down to the smallest detail we typically configure (read app/HOW_DIFFERENT_HOLO_EFFECTS_DIFFER.md and app/HOW_TO_GENERATE_A_NEW_HOLO_EFFECT.md for some ideas, although you should also look at the root screen (index.html I think) to see how the cards are displayed and how they can be configured).

A user should be able to upload a main image for a card, and an optional image for a "holo" layer (again see the read me). They should be able to configure all the different variables that impact the display of a card using 1) sliders 2) directly imputting values with defined range. E.g. for a layer of opacity, the user could use a slider and or input a value between 0 and 1 into a text box near the slider.

Try to keep the dials and font sizes small so the card can be center of attention.

Depending on what is simpler, the user can either click a button to see the card preview refresh with their updated properties, or the card should change immediately based on their new properties. The latter solution is preferred, but the focus on techincal simplicty is paramout as this is a complex feature.

The card on screen should follow the same hover logic as the index.html cards.

You can use local storage for image files.

Thanks