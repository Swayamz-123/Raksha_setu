import {body} from "express-validator"


const userRegisterValidator = () => {
    return [
        body("email")
            .trim()
            .notEmpty()
            .withMessage("Email is required")
            .isEmail()
            .withMessage("Email is invalid"),
        body("username")
            .trim()
            .notEmpty()
            .withMessage("Username is required")
            .isLowercase()
            .withMessage("Username must be in lower case")
            .isLength({min:3})
            .withMessage("Username must be at least 3 characters long"),
        body("password")
            .trim()
            .notEmpty()
            .withMessage("Password is required")
            .isLength({min:6})
            .withMessage("Password must be at least 6 characters long"),
        body("fullName")
            .optional()
            .trim()
    ]

}

const userLoginValidator = () => {
    return [
        body("email")
            .optional()
            .trim()
            .isEmail()
            .withMessage("Email is invalid"),
        body("username")
            .optional()
            .trim()
            .isLowercase()
            .withMessage("Username must be in lower case"),
        body("password")
            .trim()
            .notEmpty()
            .withMessage("Password is required"),
    ]
}

const userChangeCurrentPasswordValidator = ()=>{
    return [
        body("oldPassword").notEmpty().withMessage("Old password is required"),
        body("newPassword").notEmpty().withMessage("New Password is required"),
    ];

}

const userForgotPasswordValidator = ()=>{
    return [
        body("email")
            .notEmpty()
            .withMessage("Email is required")
            .isEmail()
            .withMessage("Email is invalid")
    ]
}

const userResetForgotPasswordValidator = ()=>{
    return [
        body("newPassword").notEmpty().withMessage("Password is required")
    ]
}

const createProjectValidator = () => {
    return [
        body("name").trim().notEmpty().withMessage("Project name is required"),
        body("description").trim().notEmpty().withMessage("Project description is required"),
    ];
};

const addMemberValidator = () => {
    return [
        body("email").isEmail().withMessage("Valid email is required"),
        body("role").optional().isIn(["admin", "project-admin", "member"]).withMessage("Invalid role"),
    ];
};

const createTaskValidator = () => {
    return [
        body("title").trim().notEmpty().withMessage("Task title is required"),
        body("description").optional().trim(),
        body("assignedTo").optional().isMongoId().withMessage("Invalid assignedTo user ID"),
        body("status").optional().isIn(["todo", "in-progress", "done"]).withMessage("Invalid status"),
    ];
};

const createNoteValidator = () => {
    return [
        body("title").trim().notEmpty().withMessage("Note title is required"),
        body("content").trim().notEmpty().withMessage("Note content is required"),
    ];
};

export {
    userRegisterValidator,
    userLoginValidator,
    userChangeCurrentPasswordValidator,
    userForgotPasswordValidator,
    userResetForgotPasswordValidator,
    createProjectValidator,
    addMemberValidator,
    createTaskValidator,
    createNoteValidator
}