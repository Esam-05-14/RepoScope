package com.example.app;

import com.example.api.Widget;
import static com.example.api.Widget.name;
import com.example.api.Gone;
import com.example.api.*;
import org.junit.Test;

public class Main {
    static {
        Class.forName("com.example.api.Widget");
    }

    private final Widget widget = null;
    private final String label = name;
    private Test test = null;
}
