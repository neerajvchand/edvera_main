"""
California Education Code — Attendance & Compliance Reference Data
Single source of truth for all EC content used by the agent.
Mirrors console/src/data/educationCodeSections.ts exactly.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class ECSection:
    section: str
    citation: str
    title: str
    effective_date: str
    summary: str
    full_text: str
    tags: list[str] = field(default_factory=list)
    used_in: list[str] = field(default_factory=list)
    related_sections: list[str] = field(default_factory=list)


EC_SECTIONS: dict[str, ECSection] = {
    "48205": ECSection(
        section="48205",
        citation="EC §48205",
        title="Excused Absence Definitions",
        effective_date="Amended January 1, 2025 (AB 2499)",
        summary=(
            "Defines all valid reasons a student may be excused from school "
            "including illness, mental and behavioral health, medical "
            "appointments, bereavement, jury duty, religious observance, "
            "cultural ceremonies, and civic events. Absences for mental or "
            "behavioral health are explicitly excused under current law. "
            "Excused absences still count toward chronic absenteeism "
            "calculations but do not count toward truancy classification."
        ),
        full_text=(
            "(a) Notwithstanding Section 48200, a pupil shall be excused "
            "from school when the absence is:\n\n"
            "(1) Due to the pupil's illness, including an absence for the "
            "benefit of the pupil's mental or behavioral health.\n\n"
            "(2) Due to quarantine under the direction of a county or city "
            "health officer.\n\n"
            "(3) For purposes of having medical, dental, optometrical, or "
            "chiropractic services rendered.\n\n"
            "(4) For purposes of attending the funeral services or grieving "
            "the death of either a member of the pupil's immediate family, "
            "or of a person that is determined by the pupil's parent or "
            "guardian to be in such close association with the pupil as to "
            "be considered the pupil's immediate family, so long as the "
            "absence is not more than five days per incident.\n\n"
            "(5) For purposes of jury duty in the manner provided for by "
            "law.\n\n"
            "(6) Due to the illness or medical appointment during school "
            "hours of a child of whom the pupil is the custodial parent, "
            "including absences to care for a sick child, for which the "
            "school shall not require a note from a doctor.\n\n"
            "(7) For justifiable personal reasons, including, but not "
            "limited to, an attendance or appearance in court, attendance "
            "at a funeral service, observance of a holiday or ceremony of "
            "the pupil's religion, attendance at a religious retreat, "
            "attendance at an employment conference, or attendance at an "
            "educational conference on the legislative or judicial process "
            "offered by a nonprofit organization, when the pupil's absence "
            "is requested in writing by the parent or guardian and approved "
            "by the principal or a designated representative pursuant to "
            "uniform standards established by the governing board of the "
            "school district.\n\n"
            "(8) For purposes of serving as a member of a precinct board "
            "for an election pursuant to Section 12302 of the Elections "
            "Code.\n\n"
            "(9) For purposes of spending time with a member of the pupil's "
            "immediate family who is an active duty member of the uniformed "
            "services, as defined in Section 49701, and has been called to "
            "duty for, is on leave from, or has immediately returned from, "
            "deployment. Absences granted pursuant to this paragraph shall "
            "be granted for a period of time to be determined at the "
            "discretion of the superintendent of the school district.\n\n"
            "(10) For purposes of attending the pupil's naturalization "
            "ceremony to become a United States citizen.\n\n"
            "(11) For purposes of participating in a cultural ceremony or "
            "event.\n\n"
            "(12) (A) For purposes of a middle school or high school pupil "
            "engaging in a civic or political event, as provided in "
            "subparagraph (B), provided that the pupil notifies the school "
            "ahead of the absence.\n"
            "(B) (i) A middle school or high school pupil who is absent "
            "pursuant to subparagraph (A) is required to be excused for "
            "only one schoolday-long absence per school year.\n"
            "(ii) A middle school or high school pupil who is absent "
            "pursuant to subparagraph (A) may be permitted additional "
            "excused absences in the discretion of a school administrator, "
            "as described in subdivision (c) of Section 48260.\n\n"
            "(13) (A) For any of the purposes described in clauses (i) to "
            "(iii), inclusive, if an immediate family member of the pupil, "
            "or a person that is determined by the pupil's parent or "
            "guardian to be in such close association with the pupil as to "
            "be considered the pupil's immediate family, has died, so long "
            "as the absence is not more than three days per incident.\n"
            "(i) To access services from a victim services organization or "
            "agency.\n"
            "(ii) To access grief support services.\n"
            "(iii) To participate in safety planning or to take other "
            "actions to increase the safety of the pupil or an immediate "
            "family member of the pupil, or a person that is determined by "
            "the pupil's parent or guardian to be in such close association "
            "with the pupil as to be considered the pupil's immediate "
            "family, including, but not limited to, temporary or permanent "
            "relocation.\n"
            "(B) Any absences beyond three days for the reasons described "
            "in subparagraph (A) shall be subject to the discretion of the "
            "school administrator, or their designee, pursuant to Section "
            "48260.\n\n"
            "(14) Due to the pupil's participation in military entrance "
            "processing.\n\n"
            "(15) Authorized at the discretion of a school administrator, "
            "as described in subdivision (c) of Section 48260.\n\n"
            "(b) A pupil absent from school pursuant to this section shall "
            "be allowed to complete all assignments and tests missed during "
            "the absence that can be reasonably provided and, upon "
            "satisfactory completion within a reasonable period of time, "
            "shall be given full credit for those assignments and tests. "
            "The teacher of the class from which a pupil is absent shall "
            "determine which tests and assignments shall be reasonably "
            "equivalent to, but not necessarily identical to, the tests "
            "and assignments that the pupil missed during the absence.\n\n"
            "(c) For purposes of this section, attendance at religious "
            "retreats shall not exceed one schoolday per semester.\n\n"
            "(d) Absences pursuant to this section are deemed to be "
            "absences in computing average daily attendance and shall not "
            "generate state apportionment payments.\n\n"
            "(e) For purposes of this section, the following definitions "
            "apply:\n"
            '(1) A "civic or political event" includes, but is not limited '
            "to, voting, poll working, strikes, public commenting, "
            "candidate speeches, political or civic forums, and town "
            "halls.\n"
            '(2) "Cultural" means relating to the practices, habits, '
            "beliefs, and traditions of a certain group of people.\n"
            '(3) "Immediate family" means the parent or guardian, brother '
            "or sister, grandparent, or any other relative living in the "
            "household of the pupil.\n"
            '(4) "Victim services organization or agency" has the same '
            "meaning as defined in subdivision (j) of Section 12945.8 of "
            "the Government Code."
        ),
        tags=["excused-absence", "chronic-absence", "classification"],
        used_in=["Absence Classification", "Import Normalizer", "Student Detail"],
        related_sections=["48260", "48260.5"],
    ),
    "48260": ECSection(
        section="48260",
        citation="EC §48260",
        title="Truancy Definition",
        effective_date="Amended January 1, 2013",
        summary=(
            "A student becomes truant after three full unexcused days, "
            "three occasions of 30+ minute unexcused tardies or partial "
            "absences, or any combination of these in one school year. "
            "This triggers Tier 1 of the compliance process and requires "
            "reporting to the attendance supervisor or superintendent. "
            "Valid excuses include reasons listed in §48205 and additional "
            "circumstances at administrator discretion."
        ),
        full_text=(
            "(a) A pupil subject to compulsory full-time education or to "
            "compulsory continuation education who is absent from school "
            "without a valid excuse three full days in one school year or "
            "tardy or absent for more than a 30-minute period during the "
            "schoolday without a valid excuse on three occasions in one "
            "school year, or any combination thereof, shall be classified "
            "as a truant and shall be reported to the attendance supervisor "
            "or to the superintendent of the school district.\n\n"
            "(b) Notwithstanding subdivision (a), it is the intent of the "
            "Legislature that school districts shall not change the method "
            "of attendance accounting provided for in existing law and "
            "shall not be required to employ period-by-period attendance "
            "accounting.\n\n"
            "(c) For purposes of this article, a valid excuse includes, "
            "but is not limited to, the reasons for which a pupil shall be "
            "excused from school pursuant to Sections 48205 and 48225.5 "
            "and may include other reasons that are within the discretion "
            "of school administrators and, based on the facts of the "
            "pupil's circumstances, are deemed to constitute a valid "
            "excuse."
        ),
        tags=["truancy", "tier1", "compliance-engine"],
        used_in=["Tier 1 Requirements", "Compliance Engine", "Action Center"],
        related_sections=["48205", "48260.5", "48262"],
    ),
    "48260.5": ECSection(
        section="48260.5",
        citation="EC §48260.5",
        title="First Truancy Notification Requirements",
        effective_date="Operative July 1, 2025 (SB 691, amended 2024)",
        summary=(
            "Upon a student's first truancy classification, the district "
            "must notify the parent or guardian that the student is truant, "
            "that the parent is obligated to compel attendance, that "
            "alternative programs exist, that mental health and supportive "
            "services may be available, and that school personnel are "
            "available to develop attendance strategies. Notification must "
            "use the most cost-effective method available including email "
            "or phone. This section was updated in 2024 to explicitly "
            "require the mental health services notice."
        ),
        full_text=(
            "Upon a pupil's initial classification as a truant, the school "
            "district shall notify the pupil's parent or guardian using the "
            "most cost-effective method possible, which may include email "
            "or a telephone call:\n\n"
            "(a) That the pupil is truant.\n\n"
            "(b) That the parent or guardian is obligated to compel the "
            "attendance of the pupil at school.\n\n"
            "(c) That alternative educational programs are available in the "
            "school district.\n\n"
            "(d) That the parent or guardian has the right to meet with "
            "appropriate school personnel to discuss solutions to the "
            "pupil's truancy.\n\n"
            "(e) That mental health and supportive services may be "
            "available to the pupil and the family.\n\n"
            "(f) That school personnel are available to meet with the pupil "
            "and family to develop strategies to support the pupil's "
            "attendance at school.\n\n"
            "(g) That research shows that missing 10 percent of school for "
            "any reason can translate into pupils having difficulty "
            "learning to read by third grade, achieving in middle school, "
            "and graduating from high school.\n\n"
            "(h) This section shall become operative on July 1, 2025."
        ),
        tags=["truancy", "tier1", "notification", "letter"],
        used_in=["Tier 1 Notification Letter", "Truancy Letter Generator"],
        related_sections=["48260", "48262"],
    ),
    "48262": ECSection(
        section="48262",
        citation="EC §48262",
        title="Habitual Truant Definition",
        effective_date="Amended October 19, 2010",
        summary=(
            "A student is habitually truant after being reported truant "
            "three or more times in a school year, provided the district "
            "has made a conscientious effort to hold at least one "
            "conference with the parent and student. Conscientious effort "
            "means at least one communication attempt by any cost-effective "
            "method including email or phone. This triggers Tier 2 and "
            "requires a parent conference before the habitual truant "
            "classification can be formally applied."
        ),
        full_text=(
            "Any pupil is deemed an habitual truant who has been reported "
            "as a truant three or more times per school year, provided "
            "that no pupil shall be deemed an habitual truant unless an "
            "appropriate district officer or employee has made a "
            "conscientious effort to hold at least one conference with a "
            "parent or guardian of the pupil and the pupil himself, after "
            "the filing of either of the reports required by Section 48260 "
            "or Section 48261. For purposes of this section, a "
            "conscientious effort means attempting to communicate with the "
            "parents of the pupil at least once using the most "
            "cost-effective method possible, which may include electronic "
            "mail or a telephone call."
        ),
        tags=["truancy", "tier2", "habitual-truant", "conference"],
        used_in=["Tier 2 Requirements", "Conference Action", "Action Center"],
        related_sections=["48260", "48263"],
    ),
    "48263": ECSection(
        section="48263",
        citation="EC §48263",
        title="SARB Referral Authority",
        effective_date="Amended January 1, 2021",
        summary=(
            "A habitually truant student, chronic absentee, or habitually "
            "insubordinate student may be referred to the School Attendance "
            "Review Board or probation department. The referring district "
            "must document all interventions undertaken and notify the "
            "student and parents in writing of the SARB name, address, and "
            "reason for referral. This is the Tier 3 trigger and applies "
            "to both truant and chronically absent students."
        ),
        full_text=(
            "(a) If a minor pupil in a school district of a county is a "
            "habitual truant, or is a chronic absentee, or is habitually "
            "insubordinate or disorderly during attendance at school, the "
            "pupil may be referred to a school attendance review board, or "
            "to the probation department for services if the probation "
            "department has elected to receive these referrals. The "
            "supervisor of attendance, or any other person the governing "
            "board of the school district may designate, making the "
            "referral shall notify the minor pupil, the pupil's parent or "
            "guardian, and the school attendance review board or probation "
            "department, in writing, of the name and address of the board "
            "or the probation department to which the matter has been "
            "referred, the reason for the referral, and the fact that the "
            "pupil, the pupil's parent or guardian, and the referring "
            "person shall meet with the school attendance review board, or "
            "the probation officer, to consider a proper disposition of "
            "the referral. The notice shall indicate that the pupil and "
            "the pupil's parent or guardian shall be required to attend a "
            "meeting with the school attendance review board, or the "
            "probation officer, to consider a proper disposition of the "
            "referral.\n\n"
            "(b) (1) If the school attendance review board or probation "
            "officer determines that available community services can "
            "resolve the problem of the truant or insubordinate pupil, "
            "then the board or probation officer shall direct the pupil or "
            "the pupil's parents or guardians, or both, to make use of "
            "those community services. The school attendance review board "
            "or probation officer may require the pupil or the pupil's "
            "parents or guardians, or both, to provide satisfactory "
            "evidence of participation in the available community "
            "services.\n\n"
            "(2) If the school attendance review board or the probation "
            "officer determines that available community services cannot "
            "resolve the problem of the truant or insubordinate pupil, or "
            "if the pupil or the pupil's parents or guardians, or both, "
            "have failed to respond to directives of the school attendance "
            "review board or the probation officer, or to services "
            "provided, the school attendance review board may notify the "
            "district attorney or the probation officer, or both, of the "
            "failure by utilizing the procedures described in Section "
            "48263.5, or the probation officer may notify the district "
            "attorney of the failure, if the party being notified has "
            "elected to participate in the truancy mediation program "
            "described in Section 48263.5.\n\n"
            "(c) In any county that has not established a school attendance "
            "review board, if the school district determines that available "
            "community resources cannot resolve the problem of the truant "
            "or insubordinate pupil, or if the pupil or the pupil's "
            "parents or guardians, or both, have failed to respond to the "
            "use of those resources or to interventions, the school "
            "district may notify the district attorney or the probation "
            "officer, or both, by utilizing the procedures described in "
            "Section 48260.6, if the party being notified has elected to "
            "participate in the truancy mediation program described in "
            "that section."
        ),
        tags=["sarb", "tier3", "referral", "chronic-absence"],
        used_in=[
            "Tier 3 Requirements",
            "SARB Packet Assembly",
            "SARB Referral Letter",
        ],
        related_sections=["48262", "48263.5", "48263.6", "48320"],
    ),
    "48263.5": ECSection(
        section="48263.5",
        citation="EC §48263.5",
        title="SARB to District Attorney Notification",
        effective_date="Amended January 1, 1995",
        summary=(
            "If SARB determines that community services cannot resolve the "
            "problem, or if the family fails to respond to SARB directives, "
            "SARB may notify the District Attorney or probation officer. "
            "The DA or probation officer may then notify parents of "
            "potential prosecution and request a meeting to discuss legal "
            "consequences. This is the escalation pathway beyond SARB."
        ),
        full_text=(
            "(a) A school attendance review board, or a probation officer "
            "in a county having a school attendance review board, may "
            "notify the district attorney or the probation officer, or "
            "both, of the following:\n\n"
            "(1) That available community services cannot resolve the "
            "truancy or insubordination problem of a pupil who has been "
            "classified as a truant.\n\n"
            "(2) That the pupil or the parents or guardians of the pupil, "
            "or both, have failed to respond to directives of the school "
            "attendance review board or services provided.\n\n"
            "The notification shall contain the name of the pupil, the "
            "name and address of the parent or guardian of the pupil, and "
            "the basis for the notification. The notification may only be "
            "made to a district attorney or probation officer who has "
            "elected to participate in the truancy mediation program "
            "described in this section.\n\n"
            "(b) Upon receipt of the notification described in subdivision "
            "(a), the district attorney or the probation officer may "
            "notify the parents or guardians of the pupil that they may be "
            "subject to prosecution pursuant to Article 6 (commencing with "
            "Section 48290) for failure to compel the attendance of the "
            "pupil at school. The district attorney or the probation "
            "officer may also request the parents or guardians of the "
            "pupil and the pupil to attend a meeting in the district "
            "attorney's office or at the probation department to discuss "
            "the possible legal consequences of the truancy of the pupil, "
            "in accordance with the procedures described in Section 601.3 "
            "of the Welfare and Institutions Code."
        ),
        tags=["sarb", "legal-escalation", "district-attorney"],
        used_in=["SARB Packet Assembly"],
        related_sections=["48263", "48291", "48293"],
    ),
    "48263.6": ECSection(
        section="48263.6",
        citation="EC §48263.6",
        title="Chronic Truant Definition",
        effective_date="Added January 1, 2011",
        summary=(
            "A student is a chronic truant if absent without valid excuse "
            "for 10% or more of school days from enrollment to current "
            "date, AND the district has fully complied with EC §48260, "
            "§48260.5, §48261, §48262, §48263, and §48291. Chronic "
            "truancy is based on unexcused absences only, distinguishing "
            "it from chronic absenteeism which counts all absences."
        ),
        full_text=(
            "Any pupil subject to compulsory full-time education or to "
            "compulsory continuation education who is absent from school "
            "without a valid excuse for 10 percent or more of the "
            "schooldays in one school year, from the date of enrollment to "
            "the current date, is deemed a chronic truant, provided that "
            "the appropriate school district officer or employee has "
            "complied with Sections 48260, 48260.5, 48261, 48262, 48263, "
            "and 48291."
        ),
        tags=["truancy", "chronic-truant", "classification"],
        used_in=["Compliance Engine", "Student Risk Signals"],
        related_sections=["48260", "48263", "48291"],
    ),
    "48291": ECSection(
        section="48291",
        citation="EC §48291",
        title="Criminal Complaint Referral",
        effective_date="Amended 1980",
        summary=(
            "If a parent or guardian is found to have violated compulsory "
            "attendance laws and continually fails to respond to SARB "
            "directives, SARB shall direct the school district to file a "
            "criminal complaint. The prosecuting authority must provide "
            "written explanation if they choose not to prosecute."
        ),
        full_text=(
            "If it appears upon investigation that any parent, guardian, "
            "or other person having control or charge of any child has "
            "violated any of the provisions of this chapter, the secretary "
            "of the board of education, except as provided in Section "
            "48292, or the clerk of the board of trustees, shall refer "
            "such person to a school attendance review board. In the event "
            "that any such parent, guardian, or other person continually "
            "and willfully fails to respond to directives of the school "
            "attendance review board or services provided, the school "
            "attendance review board shall direct the school district to "
            "make and file in the proper court a criminal complaint against "
            "the parent, guardian, or other person, charging the "
            "violation, and shall see that the charge is prosecuted by the "
            "proper authority. In the event that a criminal complaint is "
            "not prosecuted by the proper authority as recommended, the "
            "official making the determination not to prosecute shall "
            "provide the school attendance review board with a written "
            "explanation for the decision not to prosecute."
        ),
        tags=["penalties", "sarb", "criminal-complaint"],
        used_in=["SARB Packet Assembly"],
        related_sections=["48290", "48292", "48293"],
    ),
    "48292": ECSection(
        section="48292",
        citation="EC §48292",
        title="Attendance Supervisor Filing Authority",
        effective_date="Enacted 1976",
        summary=(
            "In districts with an attendance supervisor, the attendance "
            "supervisor is responsible for filing criminal complaints "
            "against parents for compulsory attendance violations. The "
            "supervisor ensures charges are prosecuted by the proper "
            "authorities."
        ),
        full_text=(
            "In counties, cities, and cities and counties, and in school "
            "districts having an attendance supervisor, the attendance "
            "supervisor shall make and file the complaint provided for by "
            "this article and shall see that the charge is prosecuted by "
            "the proper authorities."
        ),
        tags=["penalties", "attendance-supervisor"],
        used_in=["Legal Reference Only"],
        related_sections=["48291", "48293"],
    ),
    "48293": ECSection(
        section="48293",
        citation="EC §48293",
        title="Parent Criminal Penalties",
        effective_date="Amended September 14, 2006",
        summary=(
            "Parents who fail to comply with compulsory attendance laws are "
            "guilty of an infraction. Penalties are $100 for first "
            "conviction, $250 for second, and $500 for third or subsequent. "
            "Courts may order parent education and counseling instead of "
            "fines, and may order immediate re-enrollment of the student."
        ),
        full_text=(
            "(a) Any parent, guardian, or other person having control or "
            "charge of any pupil who fails to comply with this chapter, "
            "unless excused or exempted therefrom, is guilty of an "
            "infraction and shall be punished as follows:\n\n"
            "(1) Upon a first conviction, by a fine of not more than one "
            "hundred dollars ($100).\n\n"
            "(2) Upon a second conviction, by a fine of not more than two "
            "hundred fifty dollars ($250).\n\n"
            "(3) Upon a third or subsequent conviction, if the person has "
            "willfully refused to comply with this section, by a fine of "
            "not more than five hundred dollars ($500). In lieu of the fine "
            "imposed under this paragraph, the court may order the person "
            "to be placed in a parent education and counseling program.\n\n"
            "(b) A judgment that a person convicted of an infraction be "
            "punished as prescribed in subdivision (a) may also provide "
            "for the payment of the fine within a specified time, or in "
            "specified installments, or that the person shall attend the "
            "court at the specified time and place for appearance or for "
            "further order. A judgment may also provide that upon the "
            "failure of the person to pay a fine, to attend a parent "
            "education and counseling program, or to appear in court as "
            "specified in the judgment, the person shall appear before the "
            "court for further order. Willful violation of the order is "
            "punishable as contempt. An order of contempt under this "
            "subdivision shall not include imprisonment.\n\n"
            "(c) The court may also order that the person immediately "
            "enroll or reenroll the pupil in the appropriate school or "
            "educational program and provide proof of enrollment to the "
            "court. Willful violation of an order under this subdivision "
            "is punishable as civil contempt with a fine of up to one "
            "thousand dollars ($1,000). An order of contempt under this "
            "subdivision shall not include imprisonment."
        ),
        tags=["penalties", "infraction", "parent-liability"],
        used_in=["SARB Board Meeting Notice"],
        related_sections=["48291", "48292"],
    ),
    "48320": ECSection(
        section="48320",
        citation="EC §48320",
        title="SARB Legislative Intent",
        effective_date="Amended June 30, 1982",
        summary=(
            "The Legislature's intent is that intensive guidance and "
            "coordinated community services be provided before juvenile "
            "court involvement. SARBs may propose alternatives to the "
            "juvenile court system and must maximize use of community "
            "resources before any judicial involvement."
        ),
        full_text=(
            "(a) It is the intent of the Legislature in enacting this "
            "article that intensive guidance and coordinated community "
            "services shall be provided to meet the special needs of "
            "pupils with school attendance or school behavior problems.\n\n"
            "(b) If the school attendance review board determines that the "
            "existing services are inadequate to meet the special needs of "
            "any such pupil, the board may:\n\n"
            "(1) Propose and promote the use of alternatives to the "
            "juvenile court system.\n\n"
            "(2) Maximize the use of community resources and regional "
            "services before involving the judicial system.\n\n"
            "(3) Promote the understanding that the use of community-based "
            "alternatives requires the sustained commitment of agencies "
            "and citizens to improve existing resources and to develop new "
            "ones."
        ),
        tags=["sarb", "legislative-intent", "community-services"],
        used_in=["Legal Reference Only"],
        related_sections=["48263", "48263.5"],
    ),
    "49070": ECSection(
        section="49070",
        citation="EC §49070",
        title="Student Records Challenge Rights",
        effective_date="Amended January 1, 2020",
        summary=(
            "Parents and guardians may challenge student records they "
            "believe are inaccurate, misleading, or privacy-violating. "
            "The superintendent has 30 days to respond. If denied, parents "
            "may appeal to the governing board whose decision is final. "
            "Records of proceedings are destroyed one year after decision "
            "unless legal action initiated. Relevant to Edvera-generated "
            "compliance documents which become part of the student record."
        ),
        full_text=(
            "Following an inspection and review of a pupil's records, the "
            "parent or guardian of a pupil or former pupil of a school "
            "district may challenge the content of any pupil record.\n\n"
            "(a) The parent or guardian of the pupil may file a written "
            "request with the superintendent of the school district to "
            "correct or remove any information recorded in the written "
            "records concerning the pupil which the parent or guardian "
            "alleges to be any of the following:\n"
            "(1) Inaccurate.\n"
            "(2) An unsubstantiated personal conclusion or inference.\n"
            "(3) A conclusion or inference outside of the observer's area "
            "of competence.\n"
            "(4) Not based on the personal observation of a named person "
            "with the date and place of the observation noted.\n"
            "(5) Misleading.\n"
            "(6) In violation of the privacy or other rights of the "
            "pupil.\n\n"
            "(b) Within 30 days of receiving a request pursuant to "
            "subdivision (a), the superintendent or the superintendent's "
            "designee shall meet with the parent or guardian and the "
            "certified employee who recorded the information in question, "
            "if any. The superintendent shall then sustain or deny the "
            "allegations. If the superintendent sustains any or all of the "
            "allegations, the superintendent shall order the correction or "
            "the removal and destruction of the information. However, in "
            "accordance with Section 49066, the superintendent shall not "
            "order a pupil's grade to be changed unless the teacher who "
            "determined the grade is, to the extent practicable, given an "
            "opportunity to state orally, in writing, or both, the reasons "
            "for which the grade was given and is, to the extent "
            "practicable, included in all discussions relating to the "
            "changing of the grade.\n\n"
            "If the superintendent denies any or all of the allegations "
            "and the parent or guardian appeals the decision, the governing "
            "board of the school district shall, within 30 days of the "
            "appeal, determine whether or not to sustain or deny the "
            "allegations. If the governing board sustains any or all of "
            "the allegations, it shall order the superintendent to "
            "immediately correct or remove and destroy the information "
            "from the written records of the pupil.\n\n"
            "(c) The decision of the governing board shall be final. "
            "Records of the proceedings shall be maintained in a "
            "confidential manner and shall be destroyed one year after the "
            "decision of the governing board unless the parent or guardian "
            "initiates legal proceedings relative to the disputed "
            "information within the prescribed period.\n\n"
            "(d) If the final decision of the governing board is "
            "unfavorable to the parent or guardian, or if the parent or "
            "guardian accepts an unfavorable decision by the "
            "superintendent, the parent or guardian shall have the right "
            "to submit a written statement of objections to the "
            "information recorded in the written records. This statement "
            "shall become a part of the pupil's school record until the "
            "information objected to is corrected or removed."
        ),
        tags=["records", "parent-rights", "privacy"],
        used_in=["Compliance Documents", "SARB Packet"],
        related_sections=["48260", "48263"],
    ),
}


def lookup_section(section: str) -> ECSection | None:
    """Look up an EC section by number. Strips § symbol if present."""
    key = section.replace("§", "").replace("EC", "").strip()
    return EC_SECTIONS.get(key)


def get_all_sections() -> list[ECSection]:
    """Return all EC sections."""
    return list(EC_SECTIONS.values())
